-- ============================================================
-- FFSA Hub — Migration 330: Fleet — row level security + Realtime
-- ============================================================
-- PROVISIONAL NUMBER (see 329).
--
-- Who can do what (vehicles-module/docs/SPEC.md section 3):
--   • admins and fleet.manage (the Vehicle Coordinator): everything
--   • fleet.view (optional, e.g. leadership): read only
--   • settings and the checklist: admins and fleet.manage (the app lets the
--     co-ordinator sort weekly/monthly and set inspection days; SPEC 3 says
--     "Admin: … plus module settings". Tighten to admins only if Jack prefers.)
--   • drafts and tutorial progress: each person their own
--   • the fleet-files bucket has no storage policies on purpose: it is private
--     and every read and write goes through /api/vehicles/fleet/files, which
--     checks access and uses the service role (as vehicle-inspections, 104/208).
--
-- Realtime: the shared tables join the supabase_realtime publication so every
-- open Fleet page refreshes within about a second of someone else's save.
-- Realtime respects these RLS policies. First use of Realtime in the Hub:
-- check with Jack (HUB-PLAN.md, question 5).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Helpers (SECURITY DEFINER + fixed search_path, as 222)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manages_fleet()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.has_permission('fleet.manage');
$$;

CREATE OR REPLACE FUNCTION public.views_fleet()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.manages_fleet() OR public.has_permission('fleet.view');
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Shared tables: read with views_fleet(), write with manages_fleet()
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fleet_providers','fleet_vehicle_details','fleet_workshop_visits','fleet_inspections',
    'fleet_odometer_readings','fleet_time_logs','fleet_settings','fleet_files'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.views_fleet())', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.manages_fleet())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.manages_fleet()) WITH CHECK (public.manages_fleet())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.manages_fleet())', t || '_delete', t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. Per-person tables
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.fleet_inspection_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY fleet_inspection_drafts_own ON public.fleet_inspection_drafts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.manages_fleet())
  WITH CHECK (user_id = auth.uid() AND public.manages_fleet());

ALTER TABLE public.fleet_guide_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY fleet_guide_progress_own ON public.fleet_guide_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.views_fleet())
  WITH CHECK (user_id = auth.uid() AND public.views_fleet());

-- ────────────────────────────────────────────────────────────
-- 4. Realtime
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.fleet_vehicle_details,
  public.fleet_workshop_visits,
  public.fleet_inspections,
  public.fleet_odometer_readings,
  public.fleet_providers,
  public.fleet_settings;

-- ────────────────────────────────────────────────────────────
-- Validation
-- ────────────────────────────────────────────────────────────
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'fleet\_%' ORDER BY 1, 3;
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'fleet\_%' AND relkind = 'r';
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'fleet\_%';
