-- Add references_received and interview_scheduled to application response statuses
ALTER TABLE public.application_responses DROP CONSTRAINT IF EXISTS application_responses_status_check;
ALTER TABLE public.application_responses ADD CONSTRAINT application_responses_status_check
  CHECK (status IN ('submitted', 'references_received', 'interview_scheduled', 'accepted', 'rejected', 'waitlisted'));
