-- ============================================================
-- Add 'waiting_for_arrival' as a new (default) enrollment status
-- ============================================================
-- When a student is accepted, they're enrolled but haven't actually
-- arrived yet, so the default is 'waiting_for_arrival'. Admin flips
-- to 'arrived' once they show up.
-- ============================================================

ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_status_check;

ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (status IN (
    'waiting_for_arrival',
    'arrived',
    'dismissed',
    'decided_to_leave',
    'graduated'
  ));

-- New enrollments default to waiting for arrival
ALTER TABLE public.enrollments
  ALTER COLUMN status SET DEFAULT 'waiting_for_arrival';
