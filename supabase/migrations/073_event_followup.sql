-- ============================================================
-- FFSA Hub — Migration 073: Event Follow-up assignment + finished
-- ============================================================
-- Adds the human-operator layer on top of the workflow engine
-- (migrations 070/071). Each `workflow_enrollments` row becomes a
-- "follow-up" the team can claim, mark as viewed, and finish.
--
-- Scope: see project_event_followup_scope memory (locked 2026-06-01).
-- Mirrors the schools.assignable_as_contact pattern from migration
-- 055 / application_responses (assign_staff API).
--
-- All additive. Existing rows get NULL for the new columns, which
-- correctly represents "unassigned, never viewed, not yet finished".
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Permission row
-- ------------------------------------------------------------
-- Always granted scoped to a specific event (scope_type='event').
-- A grant for event A makes the user assignable on event A only.
-- Mirrors schools.assignable_as_contact exactly.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (module, key, display_name, sort_order)
VALUES (
  'events',
  'events.assignable_as_followup_handler',
  'Assignable as Event Follow-up Handler',
  50
)
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. workflow_enrollments — assignment + finished columns
-- ------------------------------------------------------------
-- staff_viewed_at: cleared whenever the assignee changes so the
-- new person sees it as unread (matches application_responses).
-- marked_finished_at: when set, the row drops out of the queue.
-- This is the manual "we got them where they need to go" flag —
-- distinct from workflow status='completed' which means the
-- automation finished. Either condition removes the row from the
-- queue, but they are tracked independently.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.workflow_enrollments
  ADD COLUMN IF NOT EXISTS assigned_staff_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_assigned_at   timestamptz,
  ADD COLUMN IF NOT EXISTS staff_assigned_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_viewed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS marked_finished_at  timestamptz,
  ADD COLUMN IF NOT EXISTS marked_finished_by  uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.workflow_enrollments.assigned_staff_id IS
  'The user who owns this follow-up. Null = unassigned (anyone with events.assignable_as_followup_handler on the event can claim it).';
COMMENT ON COLUMN public.workflow_enrollments.staff_viewed_at IS
  'Cleared on reassignment so the new owner sees the row as unread.';
COMMENT ON COLUMN public.workflow_enrollments.marked_finished_at IS
  'Manual "the person got everything they need" flag. Removes the row from the follow-up queue independently of workflow status.';

-- ────────────────────────────────────────────────────────────
-- 3. Indexes for queue queries
-- ------------------------------------------------------------
-- The follow-up queue is "active + not finished", sorted by age.
-- "My assignments" filters by assigned_staff_id; same finished
-- condition applies.
-- ────────────────────────────────────────────────────────────

-- The queue is "status='active' AND not yet marked_finished"; either
-- the workflow terminating (completed/cancelled) or a manual finish
-- removes the row, so both are folded into one partial index.

CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_followup_queue
  ON public.workflow_enrollments (enrolled_at DESC)
  WHERE status = 'active' AND marked_finished_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_assigned_staff
  ON public.workflow_enrollments (assigned_staff_id, enrolled_at DESC)
  WHERE assigned_staff_id IS NOT NULL
    AND status = 'active'
    AND marked_finished_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_unassigned
  ON public.workflow_enrollments (enrolled_at DESC)
  WHERE assigned_staff_id IS NULL
    AND status = 'active'
    AND marked_finished_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- 4. activity_events — new event types for the contact timeline
-- ------------------------------------------------------------
-- Must repeat the full list per Postgres CHECK semantics (last
-- set in migration 070). Adds three follow-up event types so
-- assign/finish actions and v3 notes show in the contact's
-- normal activity timeline.
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
    'followup_assigned', 'followup_finished', 'followup_note'
  ));

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   -- Permission row exists:
--   SELECT key, display_name FROM public.permissions
--   WHERE key = 'events.assignable_as_followup_handler';
--
--   -- New columns exist:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='workflow_enrollments'
--     AND column_name IN ('assigned_staff_id','staff_assigned_at',
--                         'staff_assigned_by','staff_viewed_at',
--                         'marked_finished_at','marked_finished_by');
--   -- expect 6 rows
--
--   -- Indexes exist:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'workflow_enrollments'
--     AND indexname LIKE 'idx_workflow_enrollments_%followup%'
--      OR indexname LIKE 'idx_workflow_enrollments_assigned%'
--      OR indexname LIKE 'idx_workflow_enrollments_unassigned%';
--
--   -- New activity_event types accepted (rollback after testing):
--   INSERT INTO public.activity_events (contact_id, event_type)
--   SELECT id, 'followup_assigned' FROM public.contacts LIMIT 1;
-- ============================================================
