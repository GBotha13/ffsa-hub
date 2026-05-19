-- ============================================================
-- FFSA Hub — Add schools.assignable_as_contact permission
-- ============================================================
-- Grants a user the ability to be picked as the point-of-contact
-- staff for applicants/enrolled students of a specific program.
-- Always granted scoped to a program (scope_type='program').
-- ============================================================

INSERT INTO public.permissions (module, key, display_name, sort_order)
VALUES (
  'schools',
  'schools.assignable_as_contact',
  'Assignable as Student Point of Contact',
  10
)
ON CONFLICT (key) DO NOTHING;
