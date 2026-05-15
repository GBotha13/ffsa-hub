-- Add section_header question type
ALTER TABLE public.application_questions DROP CONSTRAINT IF EXISTS application_questions_type_check;
ALTER TABLE public.application_questions ADD CONSTRAINT application_questions_type_check
  CHECK (type IN ('short_answer', 'long_answer', 'multiple_choice', 'yes_no', 'checkbox_group', 'country', 'phone', 'date', 'email', 'file', 'consent', 'select', 'section_header'));
