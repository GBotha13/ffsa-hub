-- ============================================================
-- FFSA Platform — Phase 1 Schema
-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PEOPLE (master human record)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.people (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  preferred_name text,
  email         text,
  phone         text,
  date_of_birth date,
  gender        text,
  nationality   text,
  address_line_1 text,
  address_line_2 text,
  city          text,
  province      text,
  country       text,
  postal_code   text,
  notes         text,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_status ON public.people (status);
CREATE INDEX idx_people_email ON public.people (email) WHERE email IS NOT NULL;
CREATE INDEX idx_people_name ON public.people (lower(first_name), lower(last_name));

-- ────────────────────────────────────────────────────────────
-- 2. PERSON TYPES
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.person_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.person_type_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id      uuid NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  person_type_id uuid NOT NULL REFERENCES public.person_types (id) ON DELETE CASCADE,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, person_type_id)
);

CREATE INDEX idx_person_type_assignments_person ON public.person_type_assignments (person_id);

-- ────────────────────────────────────────────────────────────
-- 3. TAGS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.tags (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text UNIQUE NOT NULL,
  category  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.person_tags (
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, tag_id)
);

CREATE INDEX idx_person_tags_person ON public.person_tags (person_id);

-- ────────────────────────────────────────────────────────────
-- 4. USERS (app-level, linked to auth.users)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id              uuid PRIMARY KEY, -- = auth.users.id
  person_id       uuid NOT NULL UNIQUE REFERENCES public.people (id),
  display_name    text,
  avatar_url      text,
  is_active       boolean NOT NULL DEFAULT true,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  last_sign_in_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_person ON public.users (person_id);

-- ────────────────────────────────────────────────────────────
-- 5. ROLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description  text,
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  scope_type  text CHECK (scope_type IS NULL OR scope_type IN ('program', 'team', 'event')),
  scope_id    uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.users (id),
  UNIQUE (user_id, role_id, scope_type, scope_id)
);

CREATE INDEX idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles (role_id);
CREATE INDEX idx_user_roles_scope ON public.user_roles (scope_type, scope_id)
  WHERE scope_type IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 6. EVENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  description           text,
  location              text,
  start_date            date NOT NULL,
  end_date              date,
  start_time            time,
  end_time              time,
  is_public             boolean NOT NULL DEFAULT false,
  registration_required boolean NOT NULL DEFAULT true,
  max_capacity          integer,
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_by            uuid NOT NULL REFERENCES public.users (id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_status ON public.events (status);
CREATE INDEX idx_events_start_date ON public.events (start_date);
CREATE INDEX idx_events_created_by ON public.events (created_by);

-- ────────────────────────────────────────────────────────────
-- 7. EVENT REGISTRATIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.event_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES public.people (id),
  event_id      uuid NOT NULL REFERENCES public.events (id),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'waitlisted', 'cancelled')),
  registered_by uuid REFERENCES public.users (id),
  notes         text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, event_id)
);

CREATE INDEX idx_event_registrations_event ON public.event_registrations (event_id);
CREATE INDEX idx_event_registrations_person ON public.event_registrations (person_id);

-- ────────────────────────────────────────────────────────────
-- 8. ATTENDANCE RECORDS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.attendance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES public.people (id),
  event_id        uuid NOT NULL REFERENCES public.events (id),
  status          text NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'late', 'excused')),
  checked_in_at   timestamptz,
  checked_in_by   uuid REFERENCES public.users (id),
  method          text NOT NULL DEFAULT 'manual'
                  CHECK (method IN ('manual', 'self')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, event_id)
);

CREATE INDEX idx_attendance_records_event ON public.attendance_records (event_id);
CREATE INDEX idx_attendance_records_person ON public.attendance_records (person_id);

-- ────────────────────────────────────────────────────────────
-- 9. AUDIT LOGS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.users (id),
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   uuid NOT NULL,
  changes       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at);

-- ────────────────────────────────────────────────────────────
-- 10. UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
