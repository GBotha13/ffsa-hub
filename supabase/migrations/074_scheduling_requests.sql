-- ============================================================
-- FFSA Hub — Migration 074: Event Follow-up scheduling (v2)
-- ============================================================
-- Adds the availability-poll scheduling subsystem on top of the
-- v1 follow-up queue (migration 073). Flow:
--
--   1. Team clicks "Request availability" on a queue row →
--      scheduling_requests row created (status='pending'),
--      magic_token generated, email sent to recipient.
--   2. Recipient opens /schedule/<token>, picks one or more slots
--      from a fixed grid → scheduling_slots rows inserted with
--      proposed_by='recipient', request flips to 'awaiting_selection'.
--   3. Team picks one slot → scheduling_slots.is_chosen=true on
--      that row, request flips to 'scheduled', confirmation email
--      with ICS attachment goes out.
--   4. Team can 'cancel' at any time. expires_at gates step 2
--      only (once slots are submitted, expiry no longer enforced).
--
-- Scope: see project_event_followup_scope (v2).
-- All additive. Existing data untouched.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. scheduling_requests
-- ------------------------------------------------------------
-- enrollment_id is optional so the same scheduling primitive can
-- be reused outside the follow-up queue later (e.g. ad-hoc calls
-- from a contact's detail page).
--
-- magic_token gates the public /schedule/<token> route — no
-- Supabase auth needed on the recipient side.
--
-- 'expired' is NOT a stored status: a row with status='pending'
-- and expires_at < now() is treated as expired by the app.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.scheduling_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid REFERENCES public.workflow_enrollments(id) ON DELETE SET NULL,
  contact_id        uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  requested_by      uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'awaiting_selection', 'scheduled', 'cancelled')),
  duration_minutes  integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  message           text,
  magic_token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  scheduled_at      timestamptz,
  cancelled_at      timestamptz
);

CREATE INDEX idx_scheduling_requests_enrollment ON public.scheduling_requests (enrollment_id)
  WHERE enrollment_id IS NOT NULL;
CREATE INDEX idx_scheduling_requests_contact    ON public.scheduling_requests (contact_id);
CREATE INDEX idx_scheduling_requests_token      ON public.scheduling_requests (magic_token);
CREATE INDEX idx_scheduling_requests_status     ON public.scheduling_requests (status, expires_at)
  WHERE status IN ('pending', 'awaiting_selection');

ALTER TABLE public.scheduling_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read scheduling requests"
  ON public.scheduling_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Writes (insert/update/delete) go through API routes that use the
-- service-role client; no RLS write policy is needed for admins,
-- but we add one anyway so direct authed inserts work for users
-- with the assignable handler permission on the linked event.
CREATE POLICY "Admins manage scheduling requests"
  ON public.scheduling_requests FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

COMMENT ON TABLE public.scheduling_requests IS
  'A "request for availability" sent to a contact. Magic-token gated public route lets the recipient submit slots; team then picks one. Reusable outside follow-ups (enrollment_id nullable).';

-- ────────────────────────────────────────────────────────────
-- 2. scheduling_slots
-- ------------------------------------------------------------
-- A scheduling_request may have many slots (the recipient picks
-- several; the team can also propose). is_chosen flips true on
-- exactly one slot per request once the team confirms. A partial
-- unique index enforces the "exactly one chosen" invariant.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.scheduling_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.scheduling_requests(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL CHECK (ends_at > starts_at),
  proposed_by  text NOT NULL DEFAULT 'recipient'
                  CHECK (proposed_by IN ('recipient', 'team')),
  is_chosen    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduling_slots_request ON public.scheduling_slots (request_id, starts_at);
CREATE UNIQUE INDEX uq_scheduling_slots_one_chosen
  ON public.scheduling_slots (request_id)
  WHERE is_chosen = true;

ALTER TABLE public.scheduling_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read scheduling slots"
  ON public.scheduling_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage scheduling slots"
  ON public.scheduling_slots FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

COMMENT ON TABLE public.scheduling_slots IS
  'Slots attached to a scheduling_request. proposed_by="recipient" rows come from the public /schedule/<token> page; is_chosen=true marks the final confirmed slot.';

-- ────────────────────────────────────────────────────────────
-- 3. activity_events — scheduling event types
-- ------------------------------------------------------------
-- Same pattern as migration 070/073: rewrite the full CHECK
-- constraint to add scheduling-related types so the actions show
-- on the contact's activity timeline.
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
    'workflow_enrolled', 'workflow_email_sent', 'workflow_completed', 'workflow_cancelled',
    'followup_assigned', 'followup_finished', 'followup_note',
    'scheduling_requested', 'scheduling_slots_submitted', 'scheduling_confirmed', 'scheduling_cancelled'
  ));

-- ============================================================
-- Validation (run in Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   -- Tables + RLS on:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('scheduling_requests', 'scheduling_slots');
--   -- both rows: relrowsecurity = true
--
--   -- Constraints / indexes:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename IN ('scheduling_requests', 'scheduling_slots');
--
--   -- New activity_event types accepted (rollback after testing):
--   INSERT INTO public.activity_events (contact_id, event_type)
--   SELECT id, 'scheduling_requested' FROM public.contacts LIMIT 1;
-- ============================================================
