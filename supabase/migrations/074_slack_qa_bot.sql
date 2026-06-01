-- ============================================================
-- FFSA Hub — Migration 074: Slack Q&A bot
-- ============================================================
-- Adds the audit log for the inbound Slack assistant ("hey FFSAHUB,
-- how many contacts under the Send label?") and optional DB-managed
-- allowlist columns on slack_settings.
--
-- The bot itself (src/app/api/slack/events + src/lib/slack/assistant)
-- authenticates Slack requests by signing-secret HMAC and gates
-- access to a private admin channel + a Slack user allowlist. Every
-- question it answers writes one slack_bot_queries row so there's a
-- record of who asked what, which tools/SQL ran, and what came back.
--
-- v1 access control is env-based (SLACK_ALLOWED_CHANNEL_ID /
-- SLACK_ALLOWED_USER_IDS). The slack_settings.qa_* columns below are
-- the DB-managed upgrade path so the allowlist can move out of env
-- later without a schema scramble.
--
-- Append-only. Idempotent. Apply by hand in the Supabase SQL Editor,
-- then regenerate types: supabase gen types … > src/types/database.ts
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. slack_bot_queries — one row per question answered
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.slack_bot_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_user_id   text NOT NULL,                       -- who asked (Slack U…)
  hub_user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,  -- resolved via users.slack_user_id (nullable)
  channel_id      text NOT NULL,                        -- where it was asked (C… or D… for DMs)
  slack_event_id  text,                                 -- Slack event_id, for dedupe
  question        text NOT NULL,                        -- the user's raw question text
  tool_calls      jsonb,                                -- [{name, input}] the model invoked
  sql_text        text,                                 -- set only when the read-only SQL tool ran (v2c)
  answer          text,                                 -- the final text posted back to Slack
  model_used      text,                                 -- 'haiku' | 'sonnet' (final model)
  latency_ms      integer,                              -- end-to-end answer latency
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Dedupe backstop: never log/answer the same Slack event twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_bot_queries_event
  ON public.slack_bot_queries (slack_event_id)
  WHERE slack_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slack_bot_queries_created
  ON public.slack_bot_queries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_slack_bot_queries_user
  ON public.slack_bot_queries (slack_user_id, created_at DESC);

COMMENT ON TABLE public.slack_bot_queries IS
  'Audit log of the inbound Slack Q&A assistant. One row per question: who asked, the tools/SQL run, the answer, and the model used. Written by src/lib/slack/assistant via the service-role client.';

-- ────────────────────────────────────────────────────────────
-- 2. slack_settings — optional DB-managed allowlist (v2b path)
-- ────────────────────────────────────────────────────────────
-- Nullable; code reads env first and falls back to these. Lets the
-- allowlist move to the admin UI later without a new migration.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.slack_settings
  ADD COLUMN IF NOT EXISTS qa_channel_id       text,
  ADD COLUMN IF NOT EXISTS qa_allowed_user_ids text[];

COMMENT ON COLUMN public.slack_settings.qa_channel_id IS
  'Private admin channel id where the Q&A bot answers. Falls back from env SLACK_ALLOWED_CHANNEL_ID.';
COMMENT ON COLUMN public.slack_settings.qa_allowed_user_ids IS
  'Slack user ids allowed to query the Q&A bot. Falls back from env SLACK_ALLOWED_USER_IDS.';

-- ============================================================
-- 3. RLS — admins read the log; writes are service-role only
-- ============================================================

ALTER TABLE public.slack_bot_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slack_bot_queries_select_admin ON public.slack_bot_queries;
CREATE POLICY slack_bot_queries_select_admin
  ON public.slack_bot_queries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
    )
  );

-- No INSERT policy: rows are written by createAdminClient() (service
-- role bypasses RLS), same pattern as notifications / audit_logs.

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname = 'slack_bot_queries';   -- relrowsecurity = true
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'slack_settings'
--     AND column_name IN ('qa_channel_id', 'qa_allowed_user_ids');  -- 2 rows
-- ============================================================
