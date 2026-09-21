-- ============================================================
-- FFSA Hub — Migration 217: Ministry leaders can manage bookings
-- tagged with their ministry
-- ============================================================
-- The bookings-owned `public.ministries` table (088) is a small,
-- rosterless color-coded label — it has no concept of "who belongs to
-- this ministry". Real ministry rosters (leaders vs. members) live in
-- `public.staff_ministries` / `public.staff_ministry_members` (126).
--
-- This links the two: an optional `staff_ministry_id` FK lets an admin
-- deliberately pair a booking-ministry (e.g. "HULC") with its matching
-- staff ministry roster. Once linked, any ACTIVE LEADER of that staff
-- ministry can edit/cancel bookings and series tagged with it, in
-- addition to the requester/admin/approver/manager who already could.
--
-- Not auto-mapped: the seed rows don't cleanly name-match (bookings has
-- "Brave Love" with no staff-ministry counterpart; "HULC" vs. staff
-- ministry slug "hulk"; "Worship & Prayer" vs. "prayer_and_worship") —
-- linking is a one-time admin action via the Venues & ministries page.
-- A booking-ministry with no link behaves exactly as before.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Link column
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ministries
  ADD COLUMN IF NOT EXISTS staff_ministry_id uuid
    REFERENCES public.staff_ministries (id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Scope helper — "does the current user lead the staff ministry
--    linked to this booking-ministry?" Mirrors leads_staff_ministry()
--    (126) so RLS and the API agree.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leads_booking_ministry(target_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      JOIN public.staff_ministry_members mm ON mm.staff_ministry_id = m.staff_ministry_id
      WHERE m.id = target_ministry_id
        AND mm.user_id = auth.uid()
        AND mm.member_role = 'leader'
        AND mm.status = 'active'
    );
$$;

-- ────────────────────────────────────────────────────────────
-- 3. RLS — extend the existing owner-based update/delete policies on
--    venue_bookings and booking_series (088) with the new leader path.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "venue_bookings_update" ON public.venue_bookings;
CREATE POLICY "venue_bookings_update" ON public.venue_bookings
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR requested_by = auth.uid()
    OR public.leads_booking_ministry(ministry_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR requested_by = auth.uid()
    OR public.leads_booking_ministry(ministry_id)
  );

DROP POLICY IF EXISTS "venue_bookings_delete" ON public.venue_bookings;
CREATE POLICY "venue_bookings_delete" ON public.venue_bookings
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.manage')
    OR requested_by = auth.uid()
    OR public.leads_booking_ministry(ministry_id)
  );

DROP POLICY IF EXISTS "booking_series_update" ON public.booking_series;
CREATE POLICY "booking_series_update" ON public.booking_series
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR created_by = auth.uid()
    OR public.leads_booking_ministry(ministry_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR created_by = auth.uid()
    OR public.leads_booking_ministry(ministry_id)
  );

DROP POLICY IF EXISTS "booking_series_delete" ON public.booking_series;
CREATE POLICY "booking_series_delete" ON public.booking_series
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.manage')
    OR created_by = auth.uid()
    OR public.leads_booking_ministry(ministry_id)
  );

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT name, slug, staff_ministry_id FROM public.ministries ORDER BY sort_order;
--   -- link one: UPDATE public.ministries SET staff_ministry_id = '<staff ministry id>' WHERE slug = 'hulc';
--   -- as a leader of that staff ministry: SELECT public.leads_booking_ministry('<booking ministry id>');  -> true
--   SELECT tablename, policyname, cmd FROM pg_policies
--     WHERE tablename IN ('venue_bookings','booking_series')
--     ORDER BY tablename, cmd;
-- ============================================================
