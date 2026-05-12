-- ============================================================
-- Fix reference_slots and reference_requests RLS to use
-- has_schools_access() instead of is_admin() only.
-- Aligns with migration 020 pattern.
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert reference slots" ON public.reference_slots;
DROP POLICY IF EXISTS "Admins can update reference slots" ON public.reference_slots;
DROP POLICY IF EXISTS "Admins can delete reference slots" ON public.reference_slots;
DROP POLICY IF EXISTS "Admins can read all reference requests" ON public.reference_requests;
DROP POLICY IF EXISTS "Admins can insert reference requests" ON public.reference_requests;
DROP POLICY IF EXISTS "Admins can update reference requests" ON public.reference_requests;

CREATE POLICY "Schools managers can insert reference slots"
  ON public.reference_slots FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update reference slots"
  ON public.reference_slots FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can delete reference slots"
  ON public.reference_slots FOR DELETE
  USING (public.has_schools_access());

CREATE POLICY "Schools managers can read all reference requests"
  ON public.reference_requests FOR SELECT
  USING (public.has_schools_access());

CREATE POLICY "Schools managers can insert reference requests"
  ON public.reference_requests FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools managers can update reference requests"
  ON public.reference_requests FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());
