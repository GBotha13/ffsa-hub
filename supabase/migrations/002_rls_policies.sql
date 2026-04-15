-- ============================================================
-- FFSA Platform — RLS Policies & Helper Functions
-- ============================================================
-- Run AFTER 001_phase1_schema.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS for checks)
-- ────────────────────────────────────────────────────────────

-- Get the person_id for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT person_id FROM public.users WHERE id = auth.uid();
$$;

-- Check if current user has a specific role (global or scoped)
CREATE OR REPLACE FUNCTION public.has_role(
  required_role text,
  check_scope_type text DEFAULT NULL,
  check_scope_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = required_role
      AND (
        -- Global role (no scope)
        ur.scope_type IS NULL
        -- Or matching scope
        OR (
          check_scope_type IS NOT NULL
          AND ur.scope_type = check_scope_type
          AND ur.scope_id = check_scope_id
        )
      )
  );
$$;

-- Check if current user has ANY of the given roles (global only)
CREATE OR REPLACE FUNCTION public.has_any_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY(required_roles)
      AND ur.scope_type IS NULL
  );
$$;

-- Check if current user is an admin (super_admin or admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(ARRAY['super_admin', 'admin']);
$$;

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_type_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PEOPLE POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own person record
CREATE POLICY "Users can read own person record"
  ON public.people FOR SELECT
  USING (id = public.get_my_person_id());

-- Admins and staff can read all people
CREATE POLICY "Admins and staff can read all people"
  ON public.people FOR SELECT
  USING (public.has_any_role(ARRAY['super_admin', 'admin', 'staff', 'events_admin']));

-- Admins can insert people
CREATE POLICY "Admins can insert people"
  ON public.people FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- Admins can update people
CREATE POLICY "Admins can update people"
  ON public.people FOR UPDATE
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- Users can update their own basic info
CREATE POLICY "Users can update own person record"
  ON public.people FOR UPDATE
  USING (id = public.get_my_person_id())
  WITH CHECK (id = public.get_my_person_id());

-- ────────────────────────────────────────────────────────────
-- PERSON TYPES POLICIES
-- ────────────────────────────────────────────────────────────

-- All authenticated users can read person types (reference data)
CREATE POLICY "Authenticated users can read person types"
  ON public.person_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage person types
CREATE POLICY "Admins can manage person types"
  ON public.person_types FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- PERSON TYPE ASSIGNMENTS POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own type assignments
CREATE POLICY "Users can read own type assignments"
  ON public.person_type_assignments FOR SELECT
  USING (person_id = public.get_my_person_id());

-- Admins can read all type assignments
CREATE POLICY "Admins can read all type assignments"
  ON public.person_type_assignments FOR SELECT
  USING (public.is_admin());

-- Admins can manage type assignments
CREATE POLICY "Admins can manage type assignments"
  ON public.person_type_assignments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- TAGS POLICIES
-- ────────────────────────────────────────────────────────────

-- All authenticated users can read tags
CREATE POLICY "Authenticated users can read tags"
  ON public.tags FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can manage tags
CREATE POLICY "Admins can manage tags"
  ON public.tags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- PERSON TAGS POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own tags
CREATE POLICY "Users can read own person tags"
  ON public.person_tags FOR SELECT
  USING (person_id = public.get_my_person_id());

-- Admins can read all person tags
CREATE POLICY "Admins can read all person tags"
  ON public.person_tags FOR SELECT
  USING (public.is_admin());

-- Admins can manage person tags
CREATE POLICY "Admins can manage person tags"
  ON public.person_tags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- USERS POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own user record
CREATE POLICY "Users can read own user record"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- Admins can read all user records
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (public.is_admin());

-- Admins can insert users (invitation flow)
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can update users
CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Users can update their own record (display_name, avatar)
CREATE POLICY "Users can update own user record"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- ROLES POLICIES
-- ────────────────────────────────────────────────────────────

-- All authenticated users can read roles (needed for UI)
CREATE POLICY "Authenticated users can read roles"
  ON public.roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only super_admin can manage roles
CREATE POLICY "Super admins can manage roles"
  ON public.roles FOR ALL
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

-- ────────────────────────────────────────────────────────────
-- USER ROLES POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own role assignments
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all role assignments
CREATE POLICY "Admins can read all user roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin());

-- Admins can manage role assignments
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- EVENTS POLICIES
-- ────────────────────────────────────────────────────────────

-- Anyone authenticated can see published public events
CREATE POLICY "Authenticated users can read public published events"
  ON public.events FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'published'
    AND is_public = true
  );

-- Admins and events_admin can read all events
CREATE POLICY "Admins can read all events"
  ON public.events FOR SELECT
  USING (public.is_admin() OR public.has_role('events_admin'));

-- Event creators can read their own events
CREATE POLICY "Creators can read own events"
  ON public.events FOR SELECT
  USING (created_by = auth.uid());

-- Scoped events_admin can read their scoped events
CREATE POLICY "Scoped events admin can read scoped events"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'events_admin'
        AND ur.scope_type = 'event'
        AND ur.scope_id = events.id
    )
  );

-- Admins and events_admin can create events
CREATE POLICY "Admins and events admins can create events"
  ON public.events FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- Admins, global events_admin, and creators can update events
CREATE POLICY "Admins and events admins can update events"
  ON public.events FOR UPDATE
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR created_by = auth.uid()
  );

-- ────────────────────────────────────────────────────────────
-- EVENT REGISTRATIONS POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own registrations
CREATE POLICY "Users can read own registrations"
  ON public.event_registrations FOR SELECT
  USING (person_id = public.get_my_person_id());

-- Admins and events_admin can read all registrations
CREATE POLICY "Admins can read all registrations"
  ON public.event_registrations FOR SELECT
  USING (public.is_admin() OR public.has_role('events_admin'));

-- Admins, events_admin can create registrations
CREATE POLICY "Admins can create registrations"
  ON public.event_registrations FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- Users can self-register for public events
CREATE POLICY "Users can self-register for public events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    person_id = public.get_my_person_id()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.is_public = true
        AND e.status = 'published'
        AND e.registration_required = true
    )
  );

-- Admins and events_admin can update registrations
CREATE POLICY "Admins can update registrations"
  ON public.event_registrations FOR UPDATE
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- ────────────────────────────────────────────────────────────
-- ATTENDANCE RECORDS POLICIES
-- ────────────────────────────────────────────────────────────

-- Users can read their own attendance
CREATE POLICY "Users can read own attendance"
  ON public.attendance_records FOR SELECT
  USING (person_id = public.get_my_person_id());

-- Admins and events_admin can read all attendance
CREATE POLICY "Admins can read all attendance"
  ON public.attendance_records FOR SELECT
  USING (public.is_admin() OR public.has_role('events_admin'));

-- Admins and events_admin can create attendance records
CREATE POLICY "Admins can create attendance"
  ON public.attendance_records FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- Admins and events_admin can update attendance records
CREATE POLICY "Admins can update attendance"
  ON public.attendance_records FOR UPDATE
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

-- ────────────────────────────────────────────────────────────
-- AUDIT LOGS POLICIES
-- ────────────────────────────────────────────────────────────

-- Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

-- All authenticated users can insert audit logs (via service layer)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
