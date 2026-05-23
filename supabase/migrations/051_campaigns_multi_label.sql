-- ============================================================
-- FFSA Hub — Migration 051: Multi-label campaigns
-- ============================================================
-- Pulls v2's multi-label audience composition (OR-only) into v1.
-- Replaces campaigns.label_id with a many-to-many campaign_labels
-- table. Rebuilds v_campaign_audience keyed on campaign_id.
--
-- Per-label unsubscribes are enforced by the trigger pair from
-- migration 046 (insert into unsubscribes -> delete contact_labels
-- row), so the audience view only filters on global unsubscribes
-- and email_suppressions. A per-label opt-out has already removed
-- the contact_labels row, so the contact won't appear in the join
-- for that label.
--
-- Safe because no production campaigns have been sent yet —
-- dropping label_id requires no backfill. If campaigns existed,
-- this migration would need a backfill step into campaign_labels
-- before the column drop.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.6, §5, §7
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Drop the existing view (depends on campaigns.label_id)
-- ────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.v_campaign_audience;

-- ────────────────────────────────────────────────────────────
-- 2. Drop campaigns.label_id
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.campaigns DROP COLUMN IF EXISTS label_id;

-- ────────────────────────────────────────────────────────────
-- 3. campaign_labels join
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.campaign_labels (
  campaign_id  uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  label_id     uuid NOT NULL REFERENCES public.labels(id) ON DELETE RESTRICT,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, label_id)
);

CREATE INDEX idx_campaign_labels_campaign ON public.campaign_labels (campaign_id);
CREATE INDEX idx_campaign_labels_label    ON public.campaign_labels (label_id);

ALTER TABLE public.campaign_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read campaign labels"
  ON public.campaign_labels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage campaign labels"
  ON public.campaign_labels FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.campaign_labels IS
  'Audience composition for a campaign. Many labels per campaign with OR semantics — a contact in ANY of the campaign''s labels receives the send. Replaces the single campaigns.label_id column.';

-- ────────────────────────────────────────────────────────────
-- 4. v_campaign_audience — keyed on campaign_id
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_campaign_audience AS
SELECT DISTINCT
  ccl.campaign_id,
  c.id              AS contact_id,
  c.email,
  c.email_normalized,
  c.first_name,
  c.last_name
FROM public.campaign_labels ccl
JOIN public.contact_labels cl ON cl.label_id = ccl.label_id
JOIN public.contacts c        ON c.id = cl.contact_id
WHERE c.email IS NOT NULL
  AND c.email_normalized IS NOT NULL
  AND c.marketing_status = 'subscribed'
  AND NOT EXISTS (
    SELECT 1 FROM public.unsubscribes u
    WHERE u.contact_id = c.id
      AND u.label_id IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.email_suppressions s
    WHERE s.email_normalized = c.email_normalized
  );

COMMENT ON VIEW public.v_campaign_audience IS
  'For a campaign_id, the DISTINCT contacts that should receive it. Audience = anyone holding ANY of the campaign''s labels, minus globally-unsubscribed contacts and suppressed emails. Per-label unsubscribes already removed the contact_labels row (migration 046 trigger), so no extra filter needed here.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.campaign_labels;        -- 0
--   SELECT count(*) FROM public.v_campaign_audience;    -- 0
--
--   -- Confirm label_id is gone from campaigns:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'campaigns'
--     AND column_name = 'label_id';
--   -- expect: 0 rows
--
--   -- Confirm view rebuilt and references campaign_id:
--   SELECT viewname FROM pg_views
--   WHERE schemaname = 'public' AND viewname = 'v_campaign_audience';
--   -- expect: 1 row
-- ============================================================
