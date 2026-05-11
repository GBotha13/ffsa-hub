-- ============================================================
-- FFSA Platform — Program Archive & Delete Support
-- ============================================================
-- Run AFTER 018_public_applications.sql
-- Adds: DELETE RLS policy for programs (cascade handles children)
-- ============================================================

CREATE POLICY "Admins can delete programs"
  ON public.programs FOR DELETE
  USING (public.is_admin());
