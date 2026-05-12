-- ============================================================
-- Add multiple_choice question type to application_questions
-- ============================================================

-- Update the CHECK constraint to allow 'multiple_choice'
ALTER TABLE public.application_questions DROP CONSTRAINT IF EXISTS application_questions_type_check;
ALTER TABLE public.application_questions ADD CONSTRAINT application_questions_type_check
  CHECK (type IN ('short_answer', 'long_answer', 'multiple_choice'));

-- Add options column for multiple choice questions (array of strings stored as JSONB)
ALTER TABLE public.application_questions
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]';
