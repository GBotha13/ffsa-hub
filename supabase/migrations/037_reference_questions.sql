-- ============================================================
-- Per-program reference questions
-- ------------------------------------------------------------
-- Mirrors application_questions: each program owns a list of
-- questions that the referee fills in. Supports the same types,
-- nesting (parent_question_id + show_when_answer), and ordering.
--
-- The seed function `seed_default_reference_questions(program_id)`
-- populates a program with the historical hardcoded reference form
-- (basic info, 21-trait character matrix, Christian life,
-- recommendation). Call it on every new program; the next migration
-- backfills it onto every existing program so no referee flow breaks.
-- ============================================================

CREATE TABLE public.reference_questions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id         uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  label              text NOT NULL,
  description        text,
  type               text NOT NULL DEFAULT 'short_answer',
  sort_order         integer NOT NULL DEFAULT 0,
  is_required        boolean NOT NULL DEFAULT true,
  options            jsonb DEFAULT '[]',
  parent_question_id uuid REFERENCES public.reference_questions(id) ON DELETE CASCADE,
  show_when_answer   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ref_questions_followup_paired CHECK (
    (parent_question_id IS NULL AND show_when_answer IS NULL)
    OR
    (parent_question_id IS NOT NULL AND show_when_answer IS NOT NULL)
  )
);

CREATE INDEX idx_reference_questions_program ON public.reference_questions(program_id);
CREATE INDEX idx_reference_questions_parent  ON public.reference_questions(parent_question_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reference_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.reference_questions ENABLE ROW LEVEL SECURITY;

-- Public referees need to read questions when filling out the form via token.
CREATE POLICY "Anyone can read reference questions"
  ON public.reference_questions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert reference questions"
  ON public.reference_questions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update reference questions"
  ON public.reference_questions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete reference questions"
  ON public.reference_questions FOR DELETE
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- Seed function — drops a default question set into a program.
-- Idempotent: if the program already has any reference questions,
-- it leaves them alone.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_default_reference_questions(p_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing integer;
  v_rating_opts jsonb := '["Excellent","Good","Fair","Poor"]'::jsonb;
  v_traits text[] := ARRAY[
    'Teachability',
    'Accountability',
    'Adaptability / Flexibility',
    'Concern for others',
    'Initiative',
    'Servanthood',
    'Self-discipline',
    'Personal Devotions',
    'Desire for Growth',
    'Emotional Stability',
    'Self-Image',
    'Response to Pressure',
    'Reliability & Faithfulness',
    'Financial Responsibility',
    'Vulnerability',
    'Integrity',
    'Purity',
    'Personal Appearance',
    'Physical Health',
    'Mental Health',
    'Organizational Abilities'
  ];
  v_trait text;
  v_sort integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_existing
    FROM public.reference_questions
    WHERE program_id = p_program_id;

  IF v_existing > 0 THEN
    RETURN;
  END IF;

  -- ── Section 1: Basic Information ──
  INSERT INTO public.reference_questions
    (program_id, sort_order, label, description, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Basic Information',
    'Tell us about your relationship with the applicant.',
    'section_header', false, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort, 'WhatsApp number', 'phone', false, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort, 'What is your relationship to the applicant?', 'short_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort, 'How long have you known the applicant?', 'short_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'In what context have you been part of their growth or discipleship?',
    'long_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  -- ── Section 2: Character Assessment ──
  INSERT INTO public.reference_questions
    (program_id, sort_order, label, description, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Character Assessment',
    'Rate the applicant on each of the following traits.',
    'section_header', false, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  FOREACH v_trait IN ARRAY v_traits LOOP
    INSERT INTO public.reference_questions
      (program_id, sort_order, label, type, is_required, options)
    VALUES (
      p_program_id, v_sort, v_trait, 'multiple_choice', true, v_rating_opts
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Additional comments on the applicant''s character',
    'long_answer', false, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  -- ── Section 3: Christian Life & Recommendation ──
  INSERT INTO public.reference_questions
    (program_id, sort_order, label, description, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Christian Life & Recommendation',
    NULL,
    'section_header', false, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'How would you describe the applicant''s Christian walk?',
    'multiple_choice', true,
    '["Mature","Contagious","Genuine and Growing","Over-emotional","Superficial"]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Please share why you described their walk this way.',
    'long_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'What are the applicant''s strengths and weaknesses?',
    'long_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Is the applicant actively seeking growth?',
    'long_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'In which areas of ministry or missions do you see them thriving?',
    'long_answer', true, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Would you recommend the applicant for this school?',
    'multiple_choice', true,
    '["Yes","Yes, with reservations","No"]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Please explain your recommendation.',
    'long_answer', false, '[]'::jsonb
  );
  v_sort := v_sort + 1;

  INSERT INTO public.reference_questions
    (program_id, sort_order, label, type, is_required, options)
  VALUES (
    p_program_id, v_sort,
    'Any other comments?',
    'long_answer', false, '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_reference_questions(uuid) TO authenticated, service_role;
