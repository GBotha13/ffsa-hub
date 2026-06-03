-- ============================================================
-- Scope-aware permission checks for program-scoped schools data
-- ============================================================
-- Background:
--   user_permissions rows carry (scope_type, scope_id) so a permission
--   can be granted globally (scope_type IS NULL) or scoped to a single
--   program (scope_type = 'program', scope_id = <program uuid>).
--
--   However, the existing has_permission(text) function (migration 015)
--   ignores scope entirely. The practical effect: a user granted
--   `schools.manage` scoped to program A could manage every program's
--   data via RLS, defeating the point of scoping.
--
-- Fix:
--   Add a scope-aware overload has_permission_for(key, program_id) and
--   a matching has_schools_access(program_id) overload, then update the
--   RLS policies on schools tables that carry a `program_id` (or, for
--   the `programs` table, `id`) to use the scoped check.
--
--   The original has_permission(text) and has_schools_access() (no args)
--   are intentionally left untouched so non-program-scoped policies and
--   any other callers continue to work as before. This change is
--   additive at the function level and surgical at the policy level.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Scope-aware permission check
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission_for(
  required_permission text,
  target_program_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND p.key = required_permission
      AND (
        up.scope_type IS NULL
        OR (up.scope_type = 'program' AND up.scope_id = target_program_id)
      )
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Scope-aware schools access check
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_schools_access(target_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_permission_for('schools.manage', target_program_id);
$$;

-- ────────────────────────────────────────────────────────────
-- 3. PROGRAMS (scope = id)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can insert programs" ON public.programs;
DROP POLICY IF EXISTS "Schools managers can update programs" ON public.programs;

CREATE POLICY "Schools managers can insert programs"
  ON public.programs FOR INSERT
  WITH CHECK (public.has_schools_access(id));

CREATE POLICY "Schools managers can update programs"
  ON public.programs FOR UPDATE
  USING (public.has_schools_access(id))
  WITH CHECK (public.has_schools_access(id));

-- ────────────────────────────────────────────────────────────
-- 4. COURSES
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Schools managers can update courses" ON public.courses;
DROP POLICY IF EXISTS "Schools managers can delete courses" ON public.courses;

CREATE POLICY "Schools managers can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can update courses"
  ON public.courses FOR UPDATE
  USING (public.has_schools_access(program_id))
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can delete courses"
  ON public.courses FOR DELETE
  USING (public.has_schools_access(program_id));

-- ────────────────────────────────────────────────────────────
-- 5. ENROLLMENTS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can insert enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Schools managers can update enrollments" ON public.enrollments;

CREATE POLICY "Schools managers can insert enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    public.has_schools_access(program_id)
    OR public.has_permission_for('schools.manage_enrollments', program_id)
  );

CREATE POLICY "Schools managers can update enrollments"
  ON public.enrollments FOR UPDATE
  USING (
    public.has_schools_access(program_id)
    OR public.has_permission_for('schools.manage_enrollments', program_id)
  )
  WITH CHECK (
    public.has_schools_access(program_id)
    OR public.has_permission_for('schools.manage_enrollments', program_id)
  );

-- ────────────────────────────────────────────────────────────
-- 6. APPLICATION QUESTIONS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can insert application questions" ON public.application_questions;
DROP POLICY IF EXISTS "Schools managers can update application questions" ON public.application_questions;
DROP POLICY IF EXISTS "Schools managers can delete application questions" ON public.application_questions;

CREATE POLICY "Schools managers can insert application questions"
  ON public.application_questions FOR INSERT
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can update application questions"
  ON public.application_questions FOR UPDATE
  USING (public.has_schools_access(program_id))
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can delete application questions"
  ON public.application_questions FOR DELETE
  USING (public.has_schools_access(program_id));

-- ────────────────────────────────────────────────────────────
-- 7. APPLICATION RESPONSES
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can read all application responses" ON public.application_responses;
DROP POLICY IF EXISTS "Schools managers can update application responses" ON public.application_responses;

CREATE POLICY "Schools managers can read all application responses"
  ON public.application_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_schools_access(program_id)
    OR public.has_permission_for('schools.view_applications', program_id)
    OR public.has_permission_for('schools.approve_applications', program_id)
  );

CREATE POLICY "Schools managers can update application responses"
  ON public.application_responses FOR UPDATE
  USING (
    public.has_schools_access(program_id)
    OR public.has_permission_for('schools.approve_applications', program_id)
  )
  WITH CHECK (
    public.has_schools_access(program_id)
    OR public.has_permission_for('schools.approve_applications', program_id)
  );

-- ────────────────────────────────────────────────────────────
-- 8. REFERENCE SLOTS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can insert reference slots" ON public.reference_slots;
DROP POLICY IF EXISTS "Schools managers can update reference slots" ON public.reference_slots;
DROP POLICY IF EXISTS "Schools managers can delete reference slots" ON public.reference_slots;

CREATE POLICY "Schools managers can insert reference slots"
  ON public.reference_slots FOR INSERT
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can update reference slots"
  ON public.reference_slots FOR UPDATE
  USING (public.has_schools_access(program_id))
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can delete reference slots"
  ON public.reference_slots FOR DELETE
  USING (public.has_schools_access(program_id));

-- ────────────────────────────────────────────────────────────
-- 9. REFERENCE QUESTIONS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Schools managers can insert reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Schools managers can update reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Schools managers can delete reference questions" ON public.reference_questions;

CREATE POLICY "Schools managers can insert reference questions"
  ON public.reference_questions FOR INSERT
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can update reference questions"
  ON public.reference_questions FOR UPDATE
  USING (public.has_schools_access(program_id))
  WITH CHECK (public.has_schools_access(program_id));

CREATE POLICY "Schools managers can delete reference questions"
  ON public.reference_questions FOR DELETE
  USING (public.has_schools_access(program_id));
