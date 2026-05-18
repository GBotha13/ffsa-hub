-- ============================================================
-- FFSA Hub — Migration 047: Dedup review queue + CSV imports
-- ============================================================
-- dedup_review_queue holds the email-matches-A-phone-matches-B
-- conflict case (§4 of the spec) until staff resolves it.
--
-- csv_imports tracks every CSV upload so we have a per-import
-- audit trail and can attribute contact_labels.added_via.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.8, §3.9, §11
-- ============================================================

CREATE TABLE public.dedup_review_queue (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_data          jsonb NOT NULL,
  email_match_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone_match_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  source_type            text NOT NULL CHECK (source_type IN ('form', 'csv', 'manual')),
  source_id              text,
  status                 text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved_merge', 'resolved_separate', 'resolved_discard')),
  resolved_by            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at            timestamptz,
  resolution_notes       text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dedup_queue_status      ON public.dedup_review_queue (status);
CREATE INDEX idx_dedup_queue_email_match ON public.dedup_review_queue (email_match_contact_id) WHERE email_match_contact_id IS NOT NULL;
CREATE INDEX idx_dedup_queue_phone_match ON public.dedup_review_queue (phone_match_contact_id) WHERE phone_match_contact_id IS NOT NULL;

ALTER TABLE public.dedup_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read dedup queue"
  ON public.dedup_review_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage dedup queue"
  ON public.dedup_review_queue FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.dedup_review_queue IS
  'Queued contact-creation conflicts: email matched one record but phone matched another. Staff resolves via merge/separate/discard.';

-- ────────────────────────────────────────────────────────────
-- csv_imports
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.csv_imports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename            text NOT NULL,
  row_count           integer NOT NULL,
  label_id            uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  custom_label_name   text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  imported_count      integer NOT NULL DEFAULT 0,
  matched_count       integer NOT NULL DEFAULT 0,
  review_count        integer NOT NULL DEFAULT 0,
  error_count         integer NOT NULL DEFAULT 0,
  error_log           jsonb,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE INDEX idx_csv_imports_status    ON public.csv_imports (status);
CREATE INDEX idx_csv_imports_created   ON public.csv_imports (created_at DESC);

ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read csv imports"
  ON public.csv_imports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage csv imports"
  ON public.csv_imports FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.csv_imports IS
  'Per-upload record of CSV imports. Drives the import UI status display and provides the source attribution for contact_labels.added_via = csv:<this.id>.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.dedup_review_queue;  -- 0
--   SELECT count(*) FROM public.csv_imports;         -- 0
-- ============================================================
