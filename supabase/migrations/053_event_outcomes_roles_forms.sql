-- ============================================================
-- FFSA Hub — Migration 053: Event outcomes, roles, and forms
-- ============================================================
-- Extends the Events module so events can:
--   1. Carry a base label every attached-form submission applies
--   2. Define multiple "outcomes" (calls-to-action), each with
--      its own label / email list
--   3. Hold a roster of roles (staff users, contacts, or ad-hoc
--      named volunteers)
--   4. Own forms (the forms table gains event_id), which collect
--      contact info via a public QR-code page
--   5. Record clean per-outcome response analytics
--
-- Spec: FFSA_Hub_CRM_Spec.md (Events integration addendum)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. events.base_label_id
-- ------------------------------------------------------------
-- The label applied to every contact who submits a form for
-- this event, regardless of outcome response.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS base_label_id uuid REFERENCES public.labels(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.base_label_id IS
  'Label applied to every contact who submits any form attached to this event. Event-attached forms default their base label to this.';

-- ────────────────────────────────────────────────────────────
-- 2. event_outcomes
-- ------------------------------------------------------------
-- A call-to-action belonging to an event. Each has its own
-- label; a contact who responds to the outcome gets that label.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.event_outcomes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  label_id    uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_outcomes_event ON public.event_outcomes (event_id);
CREATE INDEX idx_event_outcomes_label ON public.event_outcomes (label_id) WHERE label_id IS NOT NULL;

ALTER TABLE public.event_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read event outcomes"
  ON public.event_outcomes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage event outcomes"
  ON public.event_outcomes FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.event_outcomes IS
  'Per-event calls-to-action. Responding to an outcome (via a form field) applies the outcome label_id to the contact.';

-- ────────────────────────────────────────────────────────────
-- 3. event_roles (roster)
-- ------------------------------------------------------------
-- Each row assigns a role for the event. The assignee may be a
-- Hub user, a contact, or just a free-text name (ad-hoc
-- volunteer). At least one identifier is required.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.event_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role_name    text NOT NULL,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  contact_id   uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  display_name text,
  notes        text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR contact_id IS NOT NULL OR display_name IS NOT NULL)
);

CREATE INDEX idx_event_roles_event   ON public.event_roles (event_id);
CREATE INDEX idx_event_roles_user    ON public.event_roles (user_id)    WHERE user_id    IS NOT NULL;
CREATE INDEX idx_event_roles_contact ON public.event_roles (contact_id) WHERE contact_id IS NOT NULL;

ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read event roles"
  ON public.event_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage event roles"
  ON public.event_roles FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

COMMENT ON TABLE public.event_roles IS
  'Event roster. Assignee is a Hub user, a contact, or a free-text name for ad-hoc volunteers.';

-- ────────────────────────────────────────────────────────────
-- 4. forms.event_id + forms.records_attendance
-- ------------------------------------------------------------
-- A form may belong to an event. records_attendance toggles
-- whether a submission also creates an event_registrations row.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS records_attendance boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_forms_event ON public.forms (event_id) WHERE event_id IS NOT NULL;

COMMENT ON COLUMN public.forms.event_id IS
  'When set, this form belongs to an event and appears on the event''s Forms tab.';
COMMENT ON COLUMN public.forms.records_attendance IS
  'If true, a submission also creates an event_registrations row (status confirmed) for the contact.';

-- ────────────────────────────────────────────────────────────
-- 5. event_outcome_responses
-- ------------------------------------------------------------
-- One row per (outcome, contact) — the queryable record of who
-- responded to what. Labels are also applied via contact_labels,
-- but this table gives clean event analytics independent of any
-- later label edits.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.event_outcome_responses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id         uuid NOT NULL REFERENCES public.event_outcomes(id) ON DELETE CASCADE,
  contact_id         uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  form_submission_id uuid REFERENCES public.form_submissions(id) ON DELETE SET NULL,
  responded_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outcome_id, contact_id)
);

CREATE INDEX idx_outcome_responses_outcome ON public.event_outcome_responses (outcome_id);
CREATE INDEX idx_outcome_responses_contact ON public.event_outcome_responses (contact_id);

ALTER TABLE public.event_outcome_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read outcome responses"
  ON public.event_outcome_responses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage outcome responses"
  ON public.event_outcome_responses FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('comms_admin'));

COMMENT ON TABLE public.event_outcome_responses IS
  'Queryable record of outcome responses. Powers per-event/per-outcome reporting independent of contact_labels.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='events' AND column_name='base_label_id';        -- 1 row
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='forms' AND column_name IN ('event_id','records_attendance'); -- 2 rows
--
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('event_outcomes','event_roles','event_outcome_responses');
--   -- all three relrowsecurity = true
-- ============================================================
