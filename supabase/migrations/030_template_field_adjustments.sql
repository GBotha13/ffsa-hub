-- ============================================================
-- Template field adjustments:
--   1. Make "Preferred Name" optional
--   2. Make "Province/State" optional
--   3. Add "Are you currently on any medication?" question
-- ============================================================

-- Update template questions
UPDATE public.application_template_questions
SET is_required = false
WHERE label IN ('Preferred Name', 'Province/State', 'State/Province');

-- Also update existing program questions that were imported from the template
UPDATE public.application_questions
SET is_required = false
WHERE label IN ('Preferred Name', 'Province/State', 'State/Province');

-- Add a medication question to every template that doesn't already have one
INSERT INTO public.application_template_questions (
  template_id,
  label,
  description,
  type,
  sort_order,
  is_required,
  options
)
SELECT
  t.id,
  'Are you currently on any medication? If yes, please list your medication.',
  NULL,
  'long_answer',
  COALESCE((
    SELECT MAX(sort_order) + 1
    FROM public.application_template_questions
    WHERE template_id = t.id
  ), 0),
  false,
  '[]'::jsonb
FROM public.application_templates t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.application_template_questions q
  WHERE q.template_id = t.id
    AND lower(q.label) LIKE '%medication%'
);
