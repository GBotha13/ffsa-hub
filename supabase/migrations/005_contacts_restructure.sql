-- ============================================================
-- FFSA Platform — Migration 005: Restructure People → Contacts + Independent Users
-- ============================================================
-- This migration:
-- 1. Renames "people" to "contacts" (simple CRM/marketing directory)
-- 2. Moves personal detail fields to "users" (staff/students with logins)
-- 3. Makes users independent from contacts
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ADD PERSONAL DETAIL COLUMNS TO USERS
--    (Do this BEFORE dropping from people, so we can copy data)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name       text,
  ADD COLUMN IF NOT EXISTS last_name        text,
  ADD COLUMN IF NOT EXISTS preferred_name   text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS date_of_birth    date,
  ADD COLUMN IF NOT EXISTS gender           text,
  ADD COLUMN IF NOT EXISTS nationality      text,
  ADD COLUMN IF NOT EXISTS address_line_1   text,
  ADD COLUMN IF NOT EXISTS address_line_2   text,
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS province         text,
  ADD COLUMN IF NOT EXISTS country          text,
  ADD COLUMN IF NOT EXISTS postal_code      text,
  ADD COLUMN IF NOT EXISTS passport_country text,
  ADD COLUMN IF NOT EXISTS passport_number  text,
  ADD COLUMN IF NOT EXISTS visa_type        text,
  ADD COLUMN IF NOT EXISTS visa_expiry_date date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name         text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS health_insurance_provider      text,
  ADD COLUMN IF NOT EXISTS health_insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS health_insurance_expiry_date   date;

-- ────────────────────────────────────────────────────────────
-- 2. COPY EXISTING DATA FROM PEOPLE TO USERS
-- ────────────────────────────────────────────────────────────

UPDATE public.users u
SET
  first_name       = p.first_name,
  last_name        = p.last_name,
  preferred_name   = p.preferred_name,
  email            = p.email,
  phone            = p.phone,
  date_of_birth    = p.date_of_birth,
  gender           = p.gender,
  nationality      = p.nationality,
  address_line_1   = p.address_line_1,
  address_line_2   = p.address_line_2,
  city             = p.city,
  province         = p.province,
  country          = p.country,
  postal_code      = p.postal_code,
  passport_country = p.passport_country,
  passport_number  = p.passport_number,
  visa_type        = p.visa_type,
  visa_expiry_date = p.visa_expiry_date,
  emergency_contact_name         = p.emergency_contact_name,
  emergency_contact_phone        = p.emergency_contact_phone,
  emergency_contact_relationship = p.emergency_contact_relationship,
  health_insurance_provider      = p.health_insurance_provider,
  health_insurance_policy_number = p.health_insurance_policy_number,
  health_insurance_expiry_date   = p.health_insurance_expiry_date
FROM public.people p
WHERE p.id = u.person_id;

-- ────────────────────────────────────────────────────────────
-- 3. RENAME PEOPLE → CONTACTS
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.people RENAME TO contacts;

-- ────────────────────────────────────────────────────────────
-- 4. DROP PERSONAL DETAIL COLUMNS FROM CONTACTS
--    (Contacts are simple: name, email, phone, address, notes)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS nationality,
  DROP COLUMN IF EXISTS passport_country,
  DROP COLUMN IF EXISTS passport_number,
  DROP COLUMN IF EXISTS visa_type,
  DROP COLUMN IF EXISTS visa_expiry_date,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS emergency_contact_relationship,
  DROP COLUMN IF EXISTS health_insurance_provider,
  DROP COLUMN IF EXISTS health_insurance_policy_number,
  DROP COLUMN IF EXISTS health_insurance_expiry_date;

-- ────────────────────────────────────────────────────────────
-- 5. ADD OPTIONAL CONTACT_ID TO USERS + DROP PERSON_ID
-- ────────────────────────────────────────────────────────────

-- Add nullable contact_id (convenience link, not a dependency)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Copy existing person_id → contact_id before dropping
UPDATE public.users SET contact_id = person_id WHERE person_id IS NOT NULL;

-- Drop the mandatory person_id FK
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_person_id_fkey;
ALTER TABLE public.users DROP COLUMN IF EXISTS person_id;

-- ────────────────────────────────────────────────────────────
-- 6. RENAME person_id → contact_id ON RELATED TABLES
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.event_registrations RENAME COLUMN person_id TO contact_id;
ALTER TABLE public.attendance_records RENAME COLUMN person_id TO contact_id;
ALTER TABLE public.person_type_assignments RENAME COLUMN person_id TO contact_id;
ALTER TABLE public.person_tags RENAME COLUMN person_id TO contact_id;

-- ────────────────────────────────────────────────────────────
-- 7. UPDATE UNIQUE CONSTRAINTS (for upsert operations)
-- ────────────────────────────────────────────────────────────

-- event_registrations: drop old unique, add new
ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_person_id_event_id_key;
ALTER TABLE public.event_registrations ADD CONSTRAINT event_registrations_contact_id_event_id_key UNIQUE (contact_id, event_id);

-- attendance_records: drop old unique, add new
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_person_id_event_id_key;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_contact_id_event_id_key UNIQUE (contact_id, event_id);

-- person_type_assignments: drop old unique, add new
ALTER TABLE public.person_type_assignments DROP CONSTRAINT IF EXISTS person_type_assignments_person_id_person_type_id_key;
ALTER TABLE public.person_type_assignments ADD CONSTRAINT person_type_assignments_contact_id_person_type_id_key UNIQUE (contact_id, person_type_id);

-- ────────────────────────────────────────────────────────────
-- 8. UPDATE HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Replace get_my_person_id with get_my_contact_id
CREATE OR REPLACE FUNCTION public.get_my_contact_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contact_id FROM public.users WHERE id = auth.uid();
$$;

-- ────────────────────────────────────────────────────────────
-- 9. DROP OLD RLS POLICIES THAT DEPEND ON get_my_person_id()
--    (Must happen BEFORE dropping the old function)
-- ────────────────────────────────────────────────────────────

-- === CONTACTS POLICIES ===
DROP POLICY IF EXISTS "Users can read own person record" ON public.contacts;
DROP POLICY IF EXISTS "Admins and staff can read all people" ON public.contacts;
DROP POLICY IF EXISTS "Admins can insert people" ON public.contacts;
DROP POLICY IF EXISTS "Admins can update people" ON public.contacts;
DROP POLICY IF EXISTS "Users can update own person record" ON public.contacts;

-- === PERSON TYPE ASSIGNMENTS ===
DROP POLICY IF EXISTS "Users can read own type assignments" ON public.person_type_assignments;
DROP POLICY IF EXISTS "Admins can read all type assignments" ON public.person_type_assignments;
DROP POLICY IF EXISTS "Admins can manage type assignments" ON public.person_type_assignments;

-- === PERSON TAGS ===
DROP POLICY IF EXISTS "Users can read own person tags" ON public.person_tags;
DROP POLICY IF EXISTS "Admins can read all person tags" ON public.person_tags;
DROP POLICY IF EXISTS "Admins can manage person tags" ON public.person_tags;

-- === EVENT REGISTRATIONS ===
DROP POLICY IF EXISTS "Users can read own registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Users can self-register for public events" ON public.event_registrations;

-- === ATTENDANCE RECORDS ===
DROP POLICY IF EXISTS "Users can read own attendance" ON public.attendance_records;

-- Now safe to drop the old function
DROP FUNCTION IF EXISTS public.get_my_person_id();

CREATE POLICY "Users can read own contact record"
  ON public.contacts FOR SELECT
  USING (id = public.get_my_contact_id());

CREATE POLICY "Admins and staff can read all contacts"
  ON public.contacts FOR SELECT
  USING (public.has_any_role(ARRAY['super_admin', 'admin', 'staff', 'events_admin']));

CREATE POLICY "Admins can insert contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

CREATE POLICY "Admins can update contacts"
  ON public.contacts FOR UPDATE
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  USING (public.is_admin());

-- === PERSON TYPE ASSIGNMENTS — recreate with contact_id ===
CREATE POLICY "Users can read own type assignments"
  ON public.person_type_assignments FOR SELECT
  USING (contact_id = public.get_my_contact_id());

CREATE POLICY "Admins can read all type assignments"
  ON public.person_type_assignments FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage type assignments"
  ON public.person_type_assignments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- === PERSON TAGS — recreate with contact_id ===
CREATE POLICY "Users can read own contact tags"
  ON public.person_tags FOR SELECT
  USING (contact_id = public.get_my_contact_id());

CREATE POLICY "Admins can read all contact tags"
  ON public.person_tags FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage contact tags"
  ON public.person_tags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- === USERS — add policy for users to update their own profile fields ===
-- (existing policies still valid, but ensure users can update their own details)

-- === EVENT REGISTRATIONS — recreate with contact_id ===
CREATE POLICY "Users can read own registrations"
  ON public.event_registrations FOR SELECT
  USING (contact_id = public.get_my_contact_id());

CREATE POLICY "Users can self-register for public events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    contact_id = public.get_my_contact_id()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.is_public = true
        AND e.status = 'published'
        AND e.registration_required = true
    )
  );

-- === ATTENDANCE RECORDS — recreate with contact_id ===
CREATE POLICY "Users can read own attendance"
  ON public.attendance_records FOR SELECT
  USING (contact_id = public.get_my_contact_id());
