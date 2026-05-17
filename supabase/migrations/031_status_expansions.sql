-- ============================================================
-- Expand application and enrollment status options
-- ============================================================
-- Applications:
--   + 'waiting_for_references' between submitted and references_received
--
-- Enrollments:
--   Replaces 'active'/'completed'/'withdrawn'/'on_hold' with the new
--   journey statuses: 'arrived', 'dismissed', 'decided_to_leave', 'graduated'.
--   Existing 'active' rows are migrated to 'arrived', 'completed' to
--   'graduated', and 'withdrawn'/'on_hold' to 'dismissed'.
-- ============================================================

-- 1. Application status: add waiting_for_references
ALTER TABLE public.application_responses
  DROP CONSTRAINT IF EXISTS application_responses_status_check;

ALTER TABLE public.application_responses
  ADD CONSTRAINT application_responses_status_check
  CHECK (status IN (
    'submitted',
    'waiting_for_references',
    'references_received',
    'interview_scheduled',
    'accepted',
    'rejected',
    'waitlisted'
  ));

-- 2. Enrollment status: migrate values, then swap the check constraint
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_status_check;

UPDATE public.enrollments SET status = 'arrived'   WHERE status = 'active';
UPDATE public.enrollments SET status = 'graduated' WHERE status = 'completed';
UPDATE public.enrollments SET status = 'dismissed' WHERE status IN ('withdrawn', 'on_hold');

ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (status IN (
    'arrived',
    'dismissed',
    'decided_to_leave',
    'graduated'
  ));

-- 3. Update default so newly-created enrollments start as 'arrived'
ALTER TABLE public.enrollments
  ALTER COLUMN status SET DEFAULT 'arrived';
