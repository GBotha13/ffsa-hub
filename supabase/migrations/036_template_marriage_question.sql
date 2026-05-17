-- ============================================================
-- Add "Are you currently married?" + spouse name follow-up to
-- the FFBX Standard Application template.
-- ------------------------------------------------------------
-- The yes/no question is appended to the end of the template.
-- The spouse-name follow-up only appears when the answer is "yes".
-- Idempotent: skipped if a "married" yes/no question already exists.
-- ============================================================

DO $$
DECLARE
  v_template_id uuid;
  v_next_sort   integer;
  v_parent_id   uuid;
BEGIN
  -- Find each template by name (currently just one: "FFBX Standard Application").
  FOR v_template_id IN
    SELECT id FROM public.application_templates
  LOOP
    -- Skip templates that already have a marriage yes/no question.
    IF EXISTS (
      SELECT 1
      FROM public.application_template_questions
      WHERE template_id = v_template_id
        AND type = 'yes_no'
        AND lower(label) LIKE '%married%'
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(sort_order), -1) + 1
      INTO v_next_sort
      FROM public.application_template_questions
      WHERE template_id = v_template_id
        AND parent_question_id IS NULL;

    INSERT INTO public.application_template_questions (
      template_id, label, description, type, sort_order, is_required, options
    ) VALUES (
      v_template_id,
      'Are you currently married?',
      NULL,
      'yes_no',
      v_next_sort,
      true,
      '[]'::jsonb
    )
    RETURNING id INTO v_parent_id;

    INSERT INTO public.application_template_questions (
      template_id, label, description, type, sort_order, is_required, options,
      parent_question_id, show_when_answer
    ) VALUES (
      v_template_id,
      'What is your spouse''s full name?',
      NULL,
      'short_answer',
      0,
      true,
      '[]'::jsonb,
      v_parent_id,
      'yes'
    );
  END LOOP;
END $$;
