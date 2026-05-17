-- ============================================================
-- Conditional follow-up questions
-- ------------------------------------------------------------
-- Adds parent_question_id + show_when_answer to application_questions
-- and application_template_questions, enabling questions that only
-- appear when a parent yes/no or multiple_choice question is answered
-- a specific way. Follow-ups can themselves have follow-ups (nesting
-- is allowed; cycles are prevented by application-layer validation).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- application_questions
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_questions
  ADD COLUMN IF NOT EXISTS parent_question_id uuid
    REFERENCES public.application_questions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS show_when_answer text;

CREATE INDEX IF NOT EXISTS idx_app_questions_parent
  ON public.application_questions(parent_question_id);

-- Either both follow-up fields are set, or neither.
ALTER TABLE public.application_questions
  DROP CONSTRAINT IF EXISTS app_questions_followup_paired;
ALTER TABLE public.application_questions
  ADD CONSTRAINT app_questions_followup_paired
  CHECK (
    (parent_question_id IS NULL AND show_when_answer IS NULL)
    OR
    (parent_question_id IS NOT NULL AND show_when_answer IS NOT NULL)
  );

-- ────────────────────────────────────────────────────────────
-- application_template_questions
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_template_questions
  ADD COLUMN IF NOT EXISTS parent_question_id uuid
    REFERENCES public.application_template_questions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS show_when_answer text;

CREATE INDEX IF NOT EXISTS idx_template_questions_parent
  ON public.application_template_questions(parent_question_id);

ALTER TABLE public.application_template_questions
  DROP CONSTRAINT IF EXISTS template_questions_followup_paired;
ALTER TABLE public.application_template_questions
  ADD CONSTRAINT template_questions_followup_paired
  CHECK (
    (parent_question_id IS NULL AND show_when_answer IS NULL)
    OR
    (parent_question_id IS NOT NULL AND show_when_answer IS NOT NULL)
  );
