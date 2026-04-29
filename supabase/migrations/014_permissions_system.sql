-- ============================================================
-- FFSA Hub — Permissions System
-- ============================================================
-- Adds:
--   1. status column to users (invited → pending_approval → active)
--   2. job_title column to users
--   3. permissions table (module + key hierarchy)
--   4. user_permissions table (user → permission + optional scope)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. USERS: add status + job_title
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'pending_approval', 'active')),
  ADD COLUMN IF NOT EXISTS job_title text;

-- Backfill: anyone who already completed onboarding is active
UPDATE public.users
SET status = 'active'
WHERE accepted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_status ON public.users (status);

-- ────────────────────────────────────────────────────────────
-- 2. PERMISSIONS (master list of what can be granted)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module       text NOT NULL,   -- matches module id in modules.ts
  key          text UNIQUE NOT NULL, -- e.g. 'finance.edit'
  display_name text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_permissions_module ON public.permissions (module);

-- ────────────────────────────────────────────────────────────
-- 3. USER PERMISSIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.user_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  -- Optional scope: ties permission to a specific program, team, or event
  scope_type    text CHECK (scope_type IS NULL OR scope_type IN ('program', 'team', 'event')),
  scope_id      uuid,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  granted_by    uuid REFERENCES public.users (id),
  UNIQUE (user_id, permission_id, scope_type, scope_id)
);

CREATE INDEX idx_user_permissions_user ON public.user_permissions (user_id);
CREATE INDEX idx_user_permissions_permission ON public.user_permissions (permission_id);

-- ────────────────────────────────────────────────────────────
-- 4. SEED PERMISSIONS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (module, key, display_name, sort_order) VALUES

-- Contacts
('contacts', 'contacts.view',   'View Contacts',   10),
('contacts', 'contacts.create', 'Create Contacts', 20),
('contacts', 'contacts.edit',   'Edit Contacts',   30),
('contacts', 'contacts.delete', 'Delete Contacts', 40),

-- Events
('events', 'events.view',                 'View Events',            10),
('events', 'events.create',               'Create / Edit Events',   20),
('events', 'events.manage_registrations', 'Manage Registrations',   30),
('events', 'events.manage_attendance',    'Manage Attendance',      40),

-- Schools
('schools', 'schools.view',                'View Programs',                  10),
('schools', 'schools.manage_enrollments',  'Manage Enrollments',             20),
('schools', 'schools.view_applications',   'View Applications',              30),
('schools', 'schools.approve_applications','Approve / Reject Applications',  40),
('schools', 'schools.manage_attendance',   'Manage Attendance',              50),

-- Teams
('teams', 'teams.view',           'View Teams',    10),
('teams', 'teams.manage_members', 'Manage Members', 20),

-- Finance
('finance', 'finance.view',   'View Finance',        10),
('finance', 'finance.edit',   'Edit Finance Records', 20),
('finance', 'finance.approve','Approve Payments',     30),
('finance', 'finance.export', 'Export Reports',       40),

-- Communications
('communications', 'communications.send_announcements', 'Send Announcements',  10),
('communications', 'communications.send_emails',        'Send Emails',         20),
('communications', 'communications.manage_templates',   'Manage Templates',    30),

-- Mission
('mission', 'mission.view',   'View Mission',         10),
('mission', 'mission.manage', 'Manage Outreach Trips', 20),

-- Prayer Room
('prayer-room', 'prayer_room.manage', 'Manage Prayer Room', 10);

-- ────────────────────────────────────────────────────────────
-- 5. RLS POLICIES
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions list is readable by any authenticated user
CREATE POLICY "permissions_read" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- Only super_admin can manage permissions list
CREATE POLICY "permissions_admin_write" ON public.permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Users can read their own permissions; super_admin can read all
CREATE POLICY "user_permissions_read" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'admin')
    )
  );

-- Only super_admin can grant/revoke permissions
CREATE POLICY "user_permissions_write" ON public.user_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );
