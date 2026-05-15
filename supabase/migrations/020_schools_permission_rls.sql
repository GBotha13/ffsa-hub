-- ============================================================
-- FFSA Hub — Schools Module Permission-Based RLS
-- ============================================================
-- Updates all schools-related RLS policies to allow users
-- with schools.* permissions (not just global admins).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add a schools.manage permission (full CRUD on programs)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module, key, display_name, sort_order)
VALUES ('schools', 'schools.manage', 'Full Schools Management', 5)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Helper: does the user have any schools write permission?
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_schools_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_permission('schools.manage')
$$;

-- ────────────────────────────────────────────────────────────
-- 2. PROGRAMS — drop old, create new
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert programs" ON public.programs;
DROP POLICY IF EXISTS "Admins can update programs" ON public.programs;

CREATE POLICY "Schools managers can insert programs"
  ON public.programs FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update programs"
  ON public.programs FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

-- ────────────────────────────────────────────────────────────
-- 3. COURSES — drop old, create new
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;

CREATE POLICY "Schools managers can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update courses"
  ON public.courses FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can delete courses"
  ON public.courses FOR DELETE
  USING (public.has_schools_access());

-- ────────────────────────────────────────────────────────────
-- 4. ENROLLMENTS — drop old, create new
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Admins can update enrollments" ON public.enrollments;

CREATE POLICY "Schools managers can insert enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (public.has_schools_access() OR public.has_permission('schools.manage_enrollments'));

CREATE POLICY "Schools managers can update enrollments"
  ON public.enrollments FOR UPDATE
  USING (public.has_schools_access() OR public.has_permission('schools.manage_enrollments'))
  WITH CHECK (public.has_schools_access() OR public.has_permission('schools.manage_enrollments'));

-- ────────────────────────────────────────────────────────────
-- 5. GRADES — drop old, create new
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert grades" ON public.grades;
DROP POLICY IF EXISTS "Admins can update grades" ON public.grades;

CREATE POLICY "Schools managers can insert grades"
  ON public.grades FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update grades"
  ON public.grades FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

-- ────────────────────────────────────────────────────────────
-- 6. APPLICATION QUESTIONS — drop old, create new
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert application questions" ON public.application_questions;
DROP POLICY IF EXISTS "Admins can update application questions" ON public.application_questions;
DROP POLICY IF EXISTS "Admins can delete application questions" ON public.application_questions;

CREATE POLICY "Schools managers can insert application questions"
  ON public.application_questions FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update application questions"
  ON public.application_questions FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can delete application questions"
  ON public.application_questions FOR DELETE
  USING (public.has_schools_access());

-- ────────────────────────────────────────────────────────────
-- 7. APPLICATION RESPONSES — drop old, create new
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all application responses" ON public.application_responses;
DROP POLICY IF EXISTS "Admins can update application responses" ON public.application_responses;

CREATE POLICY "Schools managers can read all application responses"
  ON public.application_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_schools_access()
    OR public.has_permission('schools.view_applications')
    OR public.has_permission('schools.approve_applications')
  );

CREATE POLICY "Schools managers can update application responses"
  ON public.application_responses FOR UPDATE
  USING (public.has_schools_access() OR public.has_permission('schools.approve_applications'))
  WITH CHECK (public.has_schools_access() OR public.has_permission('schools.approve_applications'));
