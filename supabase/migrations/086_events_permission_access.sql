-- ============================================================
-- FFSA Hub — Migration 086: Events RLS accepts events.* permissions
-- ============================================================
-- Background: migration 002 gated the core events / event_registrations
-- tables on role-based checks only (is_admin() / has_role('events_admin')).
-- Users granted events-module access via the permission manager
-- (events.view / events.create / events.manage_registrations) could reach
-- the "Create Event" UI but their INSERT was rejected by RLS:
--     "new row violates row-level security policy for table 'events'"
-- because the policies never consulted the user_permissions table.
--
-- Migration 081 already applied this same fix to the ticketing tables
-- (orders / tickets / promo_codes). This migration extends it to the core
-- events tables, which were missed.
--
-- All changes are ADDITIVE: every existing is_admin() / has_role() /
-- created_by branch is preserved verbatim so nothing currently working
-- breaks. We only add the matching has_permission(...) key.
--
-- Mapping:
--   events                SELECT (all)  + events.view
--                         INSERT        + events.create
--                         UPDATE        + events.create
--   event_registrations   SELECT (all)  + events.view
--                         INSERT (admin)+ events.manage_registrations
--                         UPDATE        + events.manage_registrations
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- events
-- ────────────────────────────────────────────────────────────

-- SELECT: admins / global events_admin can read all events.
-- (The public-published, own-events, and scoped-events policies from
--  migration 002 are left untouched.)
DROP POLICY IF EXISTS "Admins can read all events" ON public.events;

CREATE POLICY "Admins can read all events"
  ON public.events FOR SELECT
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.view')
  );

-- INSERT: this is the policy that was blocking event creation.
DROP POLICY IF EXISTS "Admins and events admins can create events" ON public.events;

CREATE POLICY "Admins and events admins can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.create')
  );

-- UPDATE: events.create == "Create / Edit Events", so it also grants edit.
DROP POLICY IF EXISTS "Admins and events admins can update events" ON public.events;

CREATE POLICY "Admins and events admins can update events"
  ON public.events FOR UPDATE
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR created_by = auth.uid()
    OR public.has_permission('events.create')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR created_by = auth.uid()
    OR public.has_permission('events.create')
  );

-- ────────────────────────────────────────────────────────────
-- event_registrations
-- ------------------------------------------------------------
-- So a permissioned events user can also see and manage who has
-- registered for events. (The "read own" and public self-register
-- policies from migration 002 are left untouched.)
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can read all registrations" ON public.event_registrations;

CREATE POLICY "Admins can read all registrations"
  ON public.event_registrations FOR SELECT
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.view')
  );

DROP POLICY IF EXISTS "Admins can create registrations" ON public.event_registrations;

CREATE POLICY "Admins can create registrations"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.manage_registrations')
  );

DROP POLICY IF EXISTS "Admins can update registrations" ON public.event_registrations;

CREATE POLICY "Admins can update registrations"
  ON public.event_registrations FOR UPDATE
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.manage_registrations')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('events.manage_registrations')
  );

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   -- Policies recreated:
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename IN ('events','event_registrations')
--   ORDER BY tablename, cmd, policyname;
--
--   -- What does a given user actually have? (replace the email)
--   SELECT u.email, r.name AS role, p.key AS permission
--   FROM public.users u
--   LEFT JOIN public.user_roles ur ON ur.user_id = u.id
--   LEFT JOIN public.roles r ON r.id = ur.role_id
--   LEFT JOIN public.user_permissions uperm ON uperm.user_id = u.id
--   LEFT JOIN public.permissions p ON p.id = uperm.permission_id
--   WHERE u.email = 'luke@example.com';
-- ============================================================
