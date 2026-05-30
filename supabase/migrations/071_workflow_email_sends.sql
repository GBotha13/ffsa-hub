-- ============================================================
-- FFSA Hub — Migration 071: Workflow email sends (analytics)
-- ============================================================
-- Mirrors campaign_recipients for workflow step emails, so a
-- workflow send gets the same delivery/open/click/bounce tracking
-- as a campaign. The Mailtrap webhook reconciles by
-- provider_message_id against BOTH tables.
--
-- Additive. Depends on migration 070 (workflow tables).
-- ============================================================

CREATE TABLE public.workflow_email_sends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       uuid REFERENCES public.workflow_enrollments(id) ON DELETE SET NULL,
  workflow_id         uuid REFERENCES public.outcome_workflows(id) ON DELETE SET NULL,
  step_id             uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  contact_id          uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  outcome_label_id    uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  provider_message_id text,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  opened_at           timestamptz,
  first_clicked_at    timestamptz,
  bounced_at          timestamptz,
  bounce_reason       text,
  complained_at       timestamptz,
  unsubscribed_at     timestamptz
);

CREATE INDEX idx_workflow_email_sends_message  ON public.workflow_email_sends (provider_message_id);
CREATE INDEX idx_workflow_email_sends_contact  ON public.workflow_email_sends (contact_id);
CREATE INDEX idx_workflow_email_sends_workflow ON public.workflow_email_sends (workflow_id);

ALTER TABLE public.workflow_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read workflow email sends"
  ON public.workflow_email_sends FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage workflow email sends"
  ON public.workflow_email_sends FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.workflow_email_sends IS
  'One row per workflow step email. Reconciled by the Mailtrap webhook (provider_message_id) for delivery/open/click analytics, mirroring campaign_recipients.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname = 'workflow_email_sends';   -- relrowsecurity = true
-- ============================================================
