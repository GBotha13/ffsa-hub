-- Add admin_notes column to application_responses
ALTER TABLE public.application_responses
  ADD COLUMN IF NOT EXISTS admin_notes text;
