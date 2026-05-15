-- Add application_deadline to programs (nullable timestamp)
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS application_deadline timestamptz;

-- Add status_token to application_responses for public status tracking
ALTER TABLE public.application_responses ADD COLUMN IF NOT EXISTS status_token uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_application_responses_status_token ON public.application_responses(status_token);

-- Add reminder_sent_at to reference_requests for tracking reminder emails
ALTER TABLE public.reference_requests ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
