-- ============================================================
-- FFSA Hub — Migration 044: Forms + form submissions
-- ============================================================
-- Public hosted forms (mounted at /f/<slug>). Each form is bound
-- to exactly one label; submitting the form assigns that label
-- to the resulting contact. Submission history is preserved in
-- form_submissions for analytics + auditing.
--
-- Also adds the deferred FK from activity_events.related_form_id
-- back to this table.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.5, §6
-- ============================================================

CREATE TABLE public.forms (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text UNIQUE NOT NULL,
  name                 text NOT NULL,
  description          text,
  schema               jsonb NOT NULL,
  label_id             uuid NOT NULL REFERENCES public.labels(id) ON DELETE RESTRICT,
  custom_label_allowed boolean NOT NULL DEFAULT false,
  sending_identity_id  uuid REFERENCES public.sending_identities(id) ON DELETE SET NULL,
  welcome_campaign_id  uuid,   -- FK added in 045
  double_opt_in        boolean NOT NULL DEFAULT false,
  redirect_url         text,
  is_active            boolean NOT NULL DEFAULT true,
  created_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forms_slug   ON public.forms (slug);
CREATE INDEX idx_forms_label  ON public.forms (label_id);
CREATE INDEX idx_forms_active ON public.forms (is_active) WHERE is_active = true;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active forms readable by anyone"
  ON public.forms FOR SELECT
  USING (is_active = true OR public.is_admin() OR public.has_role('comms_admin'));

CREATE POLICY "Admins and comms can manage forms"
  ON public.forms FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.forms IS
  'Public hosted forms. The /f/<slug> route renders them. Submitting assigns the form''s label_id to the resulting contact.';

COMMENT ON COLUMN public.forms.schema IS
  'JSON schema describing fields. Validated by src/lib/forms/validate.ts at submit time.';

COMMENT ON COLUMN public.forms.double_opt_in IS
  'If true, new contacts created by this form get marketing_status = pending until they click the confirmation email.';

-- ────────────────────────────────────────────────────────────
-- form_submissions
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.form_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id             uuid NOT NULL REFERENCES public.forms(id) ON DELETE RESTRICT,
  contact_id          uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  raw_data            jsonb NOT NULL,
  ip_address          text,
  user_agent          text,
  consent_record_id   uuid REFERENCES public.consent_records(id) ON DELETE SET NULL,
  dedup_action        text NOT NULL CHECK (dedup_action IN ('new', 'matched', 'queued_for_review')),
  submitted_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_submissions_form     ON public.form_submissions (form_id, submitted_at DESC);
CREATE INDEX idx_form_submissions_contact  ON public.form_submissions (contact_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and comms can read submissions"
  ON public.form_submissions FOR SELECT
  USING (public.is_admin() OR public.has_role('comms_admin'));

-- Inserts come from the public form handler which runs through
-- the service-role admin client, bypassing RLS. We still allow
-- staff to insert manually if needed.
CREATE POLICY "Admins and comms can insert submissions"
  ON public.form_submissions FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.form_submissions IS
  'One row per submitted form. raw_data is the verbatim payload; contact_id is null when dedup queued the submission for review.';

-- ────────────────────────────────────────────────────────────
-- Backfill deferred FK from activity_events
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_related_form_id_fkey
  FOREIGN KEY (related_form_id) REFERENCES public.forms(id) ON DELETE SET NULL;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.forms;             -- 0
--   SELECT count(*) FROM public.form_submissions;  -- 0
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.activity_events'::regclass
--     AND conname = 'activity_events_related_form_id_fkey';
--   -- expect one row
-- ============================================================
