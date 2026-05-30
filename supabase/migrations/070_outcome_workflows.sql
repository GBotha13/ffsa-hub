-- ============================================================
-- FFSA Hub — Migration 070: Outcome workflows (automation)
-- ============================================================
-- Makes Outcomes the automation hub of an event. Each outcome
-- owns one dedicated form (1:1) and zero-or-more workflows. A
-- workflow is a trigger + an ordered list of steps:
--
--   trigger  — on_submit (any submission of the outcome's form)
--              | answer   (a form field equals a value, e.g.
--                          "Bible study" = "Yes")
--   steps    — send_email | delay | assign_label  (linear, v1)
--
-- When a submission matches a workflow's trigger, the contact is
-- enrolled. The first run executes inline (instant first email);
-- delays park the enrollment until a daily cron resumes it.
--
-- All additive. No tables dropped or reshaped.
-- Spec: project_workflows_scope (locked 2026-05-30); builds on 053.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. event_outcomes.form_id — the outcome's dedicated form (1:1)
-- ------------------------------------------------------------
-- An outcome owns exactly one form. The partial unique index
-- enforces that a given form belongs to at most one outcome.
-- ON DELETE SET NULL: deleting the form detaches it, keeps the
-- outcome (and its analytics) intact.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.event_outcomes
  ADD COLUMN IF NOT EXISTS form_id uuid REFERENCES public.forms(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_outcomes_form
  ON public.event_outcomes (form_id) WHERE form_id IS NOT NULL;

COMMENT ON COLUMN public.event_outcomes.form_id IS
  'The single form that captures responses for this outcome (1:1). Submitting it is what triggers the outcome''s workflows.';

-- ────────────────────────────────────────────────────────────
-- 2. outcome_workflows — trigger + metadata
-- ------------------------------------------------------------
-- An outcome may have several workflows (e.g. a "Yes" path and a
-- "No" path keyed on different answers).
--   trigger jsonb shapes:
--     {"type":"on_submit"}
--     {"type":"answer","field_key":"bible_study","op":"eq","value":"Yes"}
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.outcome_workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id  uuid NOT NULL REFERENCES public.event_outcomes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  trigger     jsonb NOT NULL DEFAULT '{"type":"on_submit"}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outcome_workflows_outcome ON public.outcome_workflows (outcome_id);
CREATE INDEX idx_outcome_workflows_active  ON public.outcome_workflows (is_active) WHERE is_active = true;

ALTER TABLE public.outcome_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read outcome workflows"
  ON public.outcome_workflows FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage outcome workflows"
  ON public.outcome_workflows FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.outcome_workflows IS
  'Per-outcome automation. A submission matching the trigger enrolls the contact into the ordered workflow_steps.';

-- ────────────────────────────────────────────────────────────
-- 3. workflow_steps — the ordered sequence
-- ------------------------------------------------------------
--   config jsonb by step_type:
--     send_email   {"subject":"...","body":<tiptap json>,"sending_identity_id":uuid?}
--     delay        {"days":14}
--     assign_label {"label_id":uuid}
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.workflow_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.outcome_workflows(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  step_type   text NOT NULL CHECK (step_type IN ('send_email', 'delay', 'assign_label')),
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_steps_workflow ON public.workflow_steps (workflow_id, sort_order);

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read workflow steps"
  ON public.workflow_steps FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage workflow steps"
  ON public.workflow_steps FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.workflow_steps IS
  'Ordered steps for a workflow. v1 step_types: send_email, delay, assign_label. Linear (no branching).';

-- ────────────────────────────────────────────────────────────
-- 4. workflow_enrollments — a contact's progress through a flow
-- ------------------------------------------------------------
-- current_step is the index of the NEXT step to run. next_run_at
-- is when the cron should resume (set to now() for an immediate
-- step, now()+delay after a delay step, NULL once completed).
-- The partial unique index prevents a contact from holding two
-- active enrollments in the same workflow.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.workflow_enrollments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id        uuid NOT NULL REFERENCES public.outcome_workflows(id) ON DELETE CASCADE,
  contact_id         uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  form_submission_id uuid REFERENCES public.form_submissions(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'completed', 'cancelled')),
  current_step       integer NOT NULL DEFAULT 0,
  next_run_at        timestamptz,
  enrolled_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);

-- The cron drains on (status, next_run_at); this index serves it.
CREATE INDEX idx_workflow_enrollments_due
  ON public.workflow_enrollments (status, next_run_at)
  WHERE status = 'active';
CREATE INDEX idx_workflow_enrollments_contact  ON public.workflow_enrollments (contact_id);
CREATE INDEX idx_workflow_enrollments_workflow ON public.workflow_enrollments (workflow_id);

CREATE UNIQUE INDEX uq_workflow_enrollments_active
  ON public.workflow_enrollments (workflow_id, contact_id)
  WHERE status = 'active';

ALTER TABLE public.workflow_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read workflow enrollments"
  ON public.workflow_enrollments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage workflow enrollments"
  ON public.workflow_enrollments FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.workflow_enrollments IS
  'One row per (contact, workflow run). Written by the form-submit hook and advanced by the run-workflows cron. Service-role writes bypass RLS.';

-- ────────────────────────────────────────────────────────────
-- 5. workflow_step_runs — per-step execution log (idempotency)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.workflow_step_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.workflow_enrollments(id) ON DELETE CASCADE,
  step_id       uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  status        text NOT NULL CHECK (status IN ('done', 'failed', 'skipped')),
  detail        jsonb,
  ran_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_step_runs_enrollment ON public.workflow_step_runs (enrollment_id, ran_at);

ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read workflow step runs"
  ON public.workflow_step_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage workflow step runs"
  ON public.workflow_step_runs FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.workflow_step_runs IS
  'Append-only execution log per workflow step. Powers idempotency and per-enrollment audit.';

-- ────────────────────────────────────────────────────────────
-- 6. activity_events — workflow event types
-- ------------------------------------------------------------
-- Extends the CHECK constraint last set in migration 060. The
-- full list must be repeated (Postgres has no ALTER ... ADD VALUE
-- for CHECK). Workflow sends log against the contact timeline.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_event_type_check;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_event_type_check
  CHECK (event_type IN (
    'contact_created', 'contact_updated', 'contact_merged',
    'label_added', 'label_removed',
    'form_submitted',
    'csv_imported',
    'event_attended',
    'email_sent', 'email_delivered', 'email_opened',
    'email_clicked', 'email_bounced', 'email_complained', 'email_unsubscribed',
    'note_added',
    'manual_interaction',
    'ticket_purchased', 'ticket_refunded', 'ticket_checked_in',
    'workflow_enrolled', 'workflow_email_sent', 'workflow_completed', 'workflow_cancelled'
  ));

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   -- form_id column exists:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='event_outcomes' AND column_name='form_id';        -- 1 row
--
--   -- all four tables exist with RLS on:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('outcome_workflows','workflow_steps',
--                     'workflow_enrollments','workflow_step_runs');
--   -- all four relrowsecurity = true
--
--   -- new activity types accepted (rollback after testing):
--   INSERT INTO public.activity_events (contact_id, event_type)
--   SELECT id, 'workflow_enrolled' FROM public.contacts LIMIT 1;
-- ============================================================
