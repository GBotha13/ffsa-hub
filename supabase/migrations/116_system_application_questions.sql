-- ============================================================
-- FFSA Hub — System application questions (Nationality, Home Country)
-- ============================================================
-- The two built-in fields become real, LOCKED application_questions so
-- they appear in the builder and can be reordered — but not deleted,
-- made optional, or retyped. They stay mandatory on every program.
-- ============================================================

ALTER TABLE public.application_questions
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.application_questions
  ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS aq_program_system_key
  ON public.application_questions(program_id, system_key)
  WHERE system_key IS NOT NULL;

-- Backfill: make room at the top, then add the two system questions.
UPDATE public.application_questions
  SET sort_order = sort_order + 2
  WHERE parent_question_id IS NULL;

INSERT INTO public.application_questions
  (program_id, label, description, type, sort_order, is_required, is_system, system_key)
SELECT p.id, 'Nationality',
  'Your country of citizenship. This determines your fee category.',
  'country', 0, true, true, 'nationality'
FROM public.programs p
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_questions aq
  WHERE aq.program_id = p.id AND aq.system_key = 'nationality'
);

INSERT INTO public.application_questions
  (program_id, label, description, type, sort_order, is_required, is_system, system_key)
SELECT p.id, 'Home Country',
  'Your country of residence (where you currently live).',
  'country', 1, true, true, 'home_country'
FROM public.programs p
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_questions aq
  WHERE aq.program_id = p.id AND aq.system_key = 'home_country'
);

-- New programs auto-get the two system questions.
CREATE OR REPLACE FUNCTION public.seed_system_application_questions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO application_questions
    (program_id, label, description, type, sort_order, is_required, is_system, system_key)
  VALUES
    (NEW.id, 'Nationality',
     'Your country of citizenship. This determines your fee category.',
     'country', 0, true, true, 'nationality'),
    (NEW.id, 'Home Country',
     'Your country of residence (where you currently live).',
     'country', 1, true, true, 'home_country');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS seed_system_questions ON public.programs;
CREATE TRIGGER seed_system_questions
  AFTER INSERT ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.seed_system_application_questions();
