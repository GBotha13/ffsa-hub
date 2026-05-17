-- ============================================================
-- Per-program acceptance email customization
-- ------------------------------------------------------------
-- Lets admins customise the subject + body of the acceptance email
-- sent when an applicant's status is changed to "accepted". When
-- both columns are NULL the existing default email is used; either
-- column may be set individually.
--
-- Body is plain text with {{first_name}} and {{program_name}}
-- placeholders that get substituted at send time. The text is
-- wrapped in the standard FFSA branded shell — admins do not write
-- HTML directly.
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS acceptance_email_subject text,
  ADD COLUMN IF NOT EXISTS acceptance_email_body text;
