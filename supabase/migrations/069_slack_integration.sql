-- ============================================================
-- FFSA Hub — Migration 069: Slack integration + unified notifications
-- ============================================================
-- Adds the data foundation for:
--   1. Per-person dashboard widgets (Action Queue, My Contacts
--      Activity, Team Activity) backed by `notifications`.
--   2. Slack DMs and #ffsa-activity channel posts mirroring those
--      same rows. Same row, two surfaces — one source of truth.
--
-- Design intent:
--   • A single `notifications` table carries both dashboard
--     read/resolve state AND Slack send state. No dual writes.
--   • Every activity_events row that classifies as Tier 1 or
--     Tier 2 creates one notifications row per recipient. Tier 3
--     events stay in activity_events for stat cards only.
--   • Slack send happens fire-and-forget from app code. The
--     `slack_*` columns record outcome. Failed sends are
--     retryable by a small cron.
--   • Daily digest cron groups Tier-2 rows where slack_sent_at
--     IS NULL and emits one DM per recipient with grouped
--     sections.
--
-- v1 scope: only users with comms_admin role get DMs. Enforced
-- at the routing layer in `src/lib/slack/routing.ts`, not in
-- this schema, so widening later is a code change with no
-- migration.
--
-- Append-only. Idempotent (IF NOT EXISTS everywhere).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. users.slack_user_id — per-user DM target
-- ────────────────────────────────────────────────────────────
-- Populated by the admin integration page via either
-- `slack.users.lookupByEmail` (auto) or manual override.
-- Nullable; a missing value just means "no DM for this user."
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS slack_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_slack_user_id
  ON public.users (slack_user_id)
  WHERE slack_user_id IS NOT NULL;

COMMENT ON COLUMN public.users.slack_user_id IS
  'Slack workspace user ID (starts with U…). When set, this user receives Slack DMs for Tier-1 events and the daily Tier-2 digest. Populated via /integrations/slack admin page.';

-- ────────────────────────────────────────────────────────────
-- 2. notifications — unified row store
-- ────────────────────────────────────────────────────────────
-- One row per (recipient × event). Surfaces:
--   • Dashboard Action Queue   = tier='tier1' AND resolved_at IS NULL
--   • My Contacts Activity     = tier='tier2'
--   • Slack DM                 = slack_channel='dm' AND slack_sent_at IS NULL
--                                (the dispatcher / digest cron handle send)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier             text NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3')),
  event_type       text NOT NULL,        -- matches activity_events.event_type or 'assignment_changed'
  source_event_id  uuid REFERENCES public.activity_events(id) ON DELETE SET NULL,

  -- Subject of the notification. contact_id covers most events;
  -- resource_type/resource_id covers non-contact events such as
  -- 'assignment_changed' (resource_type='application_response' | 'enrollment').
  contact_id       uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  resource_type    text CHECK (resource_type IS NULL OR resource_type IN
                    ('application_response', 'enrollment', 'contact', 'order')),
  resource_id      uuid,

  -- Render fields (frozen at write time so list views don't need joins)
  title            text NOT NULL,
  body             text,
  payload          jsonb,
  url              text,                  -- deep link for dashboard row + Slack button

  -- Dashboard state
  read_at          timestamptz,
  resolved_at      timestamptz,
  auto_resolved    boolean NOT NULL DEFAULT false,

  -- Slack state
  slack_channel    text NOT NULL CHECK (slack_channel IN ('dm', 'channel', 'none')),
  slack_message_ts text,                  -- Slack message timestamp on success
  slack_sent_at    timestamptz,
  slack_error      text,                  -- last error string, null on success
  slack_attempts   int NOT NULL DEFAULT 0,
  digest_batch_id  uuid,                  -- set when included in a digest run

  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup for the dashboard Action Queue (unresolved tier1)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unresolved
  ON public.notifications (recipient_id, created_at DESC)
  WHERE resolved_at IS NULL;

-- Fast lookup for Slack send queue / retry cron
CREATE INDEX IF NOT EXISTS idx_notifications_pending_send
  ON public.notifications (tier, recipient_id, slack_sent_at)
  WHERE slack_sent_at IS NULL AND slack_channel <> 'none';

-- Fast lookup for "all notifications on this resource"
CREATE INDEX IF NOT EXISTS idx_notifications_resource
  ON public.notifications (resource_type, resource_id)
  WHERE resource_type IS NOT NULL;

-- Fast lookup for "all notifications on this contact"
CREATE INDEX IF NOT EXISTS idx_notifications_contact
  ON public.notifications (contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

COMMENT ON TABLE public.notifications IS
  'Per-recipient notification rows backing both the dashboard widgets and Slack DMs/channel posts. Created by src/lib/slack/notify.ts:dispatchNotification from logActivity() and from the assign-staff routes.';

COMMENT ON COLUMN public.notifications.tier IS
  'Signal tier. tier1 = action required (instant Slack DM). tier2 = activity on my contacts (daily digest DM + channel post). tier3 = ambient (dashboard stat cards only, never written to Slack).';

COMMENT ON COLUMN public.notifications.slack_channel IS
  'Intended Slack destination. dm = direct message to recipient_id''s slack_user_id. channel = post to slack_settings.channel_id. none = dashboard-only row.';

COMMENT ON COLUMN public.notifications.auto_resolved IS
  'TRUE when resolved_at was set by an auto-resolve rule (e.g., bounce → email_suppressions insert) rather than a user click.';

-- ────────────────────────────────────────────────────────────
-- 3. notification_preferences — per-user opt-in/out
-- ────────────────────────────────────────────────────────────
-- Rows are created lazily on first user visit to the prefs UI.
-- Absent row = use defaults (all enabled, digest at 06:00 UTC).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                   uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tier1_dm_enabled          boolean NOT NULL DEFAULT true,
  tier2_digest_enabled      boolean NOT NULL DEFAULT true,
  digest_hour_utc           smallint NOT NULL DEFAULT 6
    CHECK (digest_hour_utc BETWEEN 0 AND 23),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS
  'Per-user notification opt-outs. Missing row = use defaults. Tier-1 DMs and Tier-2 digest can be independently disabled.';

-- ────────────────────────────────────────────────────────────
-- 4. slack_settings — singleton workspace install state
-- ────────────────────────────────────────────────────────────
-- One row, id='global'. Set via the admin integration page.
-- bot_token is NOT stored here — only in env (SLACK_BOT_TOKEN).
-- bot_token_ref records the env var name purely for human ops.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.slack_settings (
  id              text PRIMARY KEY DEFAULT 'global'
                    CHECK (id = 'global'),
  bot_token_ref   text DEFAULT 'SLACK_BOT_TOKEN',
  workspace_id    text,
  channel_id      text,                  -- #ffsa-activity channel id (Slack format: C…)
  channel_name    text,                  -- human label, e.g. '#ffsa-activity'
  installed_at    timestamptz,
  installed_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton so the admin page always has a row to read.
INSERT INTO public.slack_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.slack_settings IS
  'Singleton (id=''global'') holding workspace install state. The bot token lives in env SLACK_BOT_TOKEN — only the env var name is recorded here for ops clarity.';

-- ============================================================
-- 5. RLS
-- ============================================================
-- Pattern:
--   • Users SELECT/UPDATE their own notifications + preferences.
--   • slack_settings is SELECT-only to authenticated users
--     (the admin page reads it). Writes go through service-role
--     via the admin integration API.
--   • notifications inserts come from createAdminClient() in
--     dispatchNotification — no INSERT policy needed.
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_settings ENABLE ROW LEVEL SECURITY;

-- notifications: a user sees only their own rows
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- notification_preferences: own row only
DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- slack_settings: read-only to authenticated
DROP POLICY IF EXISTS slack_settings_select_all ON public.slack_settings;
CREATE POLICY slack_settings_select_all
  ON public.slack_settings FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('notifications', 'notification_preferences', 'slack_settings');
--   -- all three rows should have relrowsecurity = true
--
--   SELECT id, channel_id, channel_name FROM public.slack_settings;
--   -- one row, id='global', channel_id NULL until set via admin page
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name = 'slack_user_id';
--   -- one row
-- ============================================================
