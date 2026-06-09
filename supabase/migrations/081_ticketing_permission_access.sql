-- ============================================================
-- FFSA Hub — Migration 081: Ticketing RLS accepts events.* permissions
-- ============================================================
-- Background: migration 057 gated orders / tickets / promo_codes /
-- payment_fee_profiles on role-based checks only (events_admin,
-- finance_admin). Users granted full events-module permissions via
-- the permission manager (events.view / events.manage_registrations /
-- events.manage_attendance / events.create) had no way to see ticketing
-- data because the policies never consulted the user_permissions table.
--
-- This migration drops and recreates those policies to also accept the
-- matching has_permission(...) keys. Existing is_admin() / has_role()
-- branches are preserved verbatim so nothing currently working breaks.
--
-- Mapping (additive on top of the migration 057 policies):
--   orders                SELECT  + events.view
--                         ALL     + events.manage_registrations
--   tickets               SELECT  + events.view
--                         ALL     + events.manage_attendance
--   promo_codes           SELECT  + events.view
--                         ALL     + events.create
--   payment_fee_profiles  SELECT  + events.view
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- orders
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins, events, finance can read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins, events, finance can manage orders" ON public.orders;

CREATE POLICY "Admins, events, finance can read orders"
  ON public.orders FOR SELECT
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_role('finance_admin')
    OR public.has_permission('events.view')
  );

CREATE POLICY "Admins, events, finance can manage orders"
  ON public.orders FOR ALL
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_role('finance_admin')
    OR public.has_permission('events.manage_registrations')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_role('finance_admin')
    OR public.has_permission('events.manage_registrations')
  );

-- ────────────────────────────────────────────────────────────
-- tickets
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and events can read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins and events can manage tickets" ON public.tickets;

CREATE POLICY "Admins and events can read tickets"
  ON public.tickets FOR SELECT
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.view')
  );

CREATE POLICY "Admins and events can manage tickets"
  ON public.tickets FOR ALL
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.manage_attendance')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.manage_attendance')
  );

-- ────────────────────────────────────────────────────────────
-- promo_codes
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and events can read promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins and events can manage promo codes" ON public.promo_codes;

CREATE POLICY "Admins and events can read promo codes"
  ON public.promo_codes FOR SELECT
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.view')
  );

CREATE POLICY "Admins and events can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.create')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.create')
  );

-- ────────────────────────────────────────────────────────────
-- payment_fee_profiles
-- ------------------------------------------------------------
-- Read-only widening: the pricing preview on ticket-type forms
-- needs these rates. Manage policy stays finance-only.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins, finance, events can read fee profiles" ON public.payment_fee_profiles;

CREATE POLICY "Admins, finance, events can read fee profiles"
  ON public.payment_fee_profiles FOR SELECT
  USING (
    public.is_admin()
    OR public.has_role('finance_admin')
    OR public.has_role('events_admin')
    OR public.has_permission('events.view')
  );

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   -- Policies recreated:
--   SELECT tablename, policyname
--   FROM pg_policies
--   WHERE tablename IN ('orders','tickets','promo_codes','payment_fee_profiles')
--   ORDER BY tablename, policyname;
--
--   -- Spot-check: a non-admin user with events.view should now see orders.
--   -- (Run as that user via the JWT — service-role bypasses RLS.)
--   SELECT count(*) FROM public.orders;
-- ============================================================
