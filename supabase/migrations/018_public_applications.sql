-- ============================================================
-- FFSA Platform — Public Applications Support
-- ============================================================
-- Run AFTER 017_fix_outreach_finance_rls.sql
-- Allows anonymous (unauthenticated) applicants to submit
-- applications via a public URL.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Make user_id NULLABLE (anonymous applicants won't have one)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_responses
  ALTER COLUMN user_id DROP NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Add columns for anonymous applicant data
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_responses
  ADD COLUMN IF NOT EXISTS applicant_email text,
  ADD COLUMN IF NOT EXISTS applicant_info  jsonb;

-- ────────────────────────────────────────────────────────────
-- 3. Replace the old UNIQUE constraint with partial uniques
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_responses
  DROP CONSTRAINT IF EXISTS application_responses_user_id_program_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_resp_user_program
  ON public.application_responses (user_id, program_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_resp_email_program
  ON public.application_responses (applicant_email, program_id)
  WHERE user_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- 4. Index for email lookups
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_app_responses_applicant_email
  ON public.application_responses (applicant_email)
  WHERE applicant_email IS NOT NULL;
