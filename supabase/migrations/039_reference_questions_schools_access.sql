-- ============================================================
-- Fix reference_questions RLS to use has_schools_access()
-- instead of is_admin() only.
-- Aligns with migrations 020 and 023.
--
-- Without this, users with the `schools.manage` permission
-- (but not the `admin`/`super_admin` role) hit
--   "Cannot coerce the result to a single JSON object"
-- when editing a reference question, because RLS silently
-- filters the row out of the UPDATE ... RETURNING result and
-- `.single()` then throws on an empty result set.
-- ============================================================

-- Drop both old and new policy names so this migration is idempotent
-- and safe to re-run against a database in any partially-applied state.
DROP POLICY IF EXISTS "Admins can insert reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Admins can update reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Admins can delete reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Schools managers can insert reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Schools managers can update reference questions" ON public.reference_questions;
DROP POLICY IF EXISTS "Schools managers can delete reference questions" ON public.reference_questions;

CREATE POLICY "Schools managers can insert reference questions"
  ON public.reference_questions FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update reference questions"
  ON public.reference_questions FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can delete reference questions"
  ON public.reference_questions FOR DELETE
  USING (public.has_schools_access());
