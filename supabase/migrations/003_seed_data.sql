-- ============================================================
-- FFSA Platform — Seed Data (Roles & Person Types)
-- ============================================================
-- Run AFTER 001 and 002
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SEED ROLES
-- ────────────────────────────────────────────────────────────

INSERT INTO public.roles (name, display_name, description, is_system) VALUES
  ('super_admin',    'Super Admin',         'Full system access. Can manage platform settings, roles, and all data.', true),
  ('admin',          'Admin',               'Broad operational access. Can manage people, events, users, and roles.', true),
  ('events_admin',   'Events Admin',        'Can manage events, registrations, and attendance. Can be global or scoped.', true),
  ('program_leader', 'Program Leader',      'Can manage assigned programs, enrolled students, and academic records.', true),
  ('team_leader',    'Team Leader',         'Can manage assigned teams and team members.', true),
  ('staff',          'Staff',               'Base staff member. Can view people directory and events.', true),
  ('student',        'Student',             'Enrolled in a program. Mostly self-access.', true),
  ('self_service',   'Self-Service User',   'Minimal access. Can view own profile, registrations, and attendance.', true)
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SEED PERSON TYPES
-- ────────────────────────────────────────────────────────────

INSERT INTO public.person_types (name, description) VALUES
  ('staff',      'Base staff member'),
  ('student',    'Currently or previously enrolled in a program'),
  ('volunteer',  'Volunteer helper'),
  ('attendee',   'Event attendee (no ongoing role)'),
  ('speaker',    'Guest speaker or teacher'),
  ('alumni',     'Former student who has graduated')
ON CONFLICT (name) DO NOTHING;
