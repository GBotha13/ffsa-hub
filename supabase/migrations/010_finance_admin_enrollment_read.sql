-- ============================================================
-- FFSA Platform — Finance Admin Enrollment Read Access
-- ============================================================
-- Fixes: finance_admin users couldn't see enrolled students
-- on the school fees page because enrollments RLS only allowed
-- is_admin() (super_admin/admin), not finance_admin.
-- ============================================================

CREATE POLICY "Finance admins can read all enrollments"
  ON public.enrollments FOR SELECT
  USING (public.has_role('finance_admin'));
