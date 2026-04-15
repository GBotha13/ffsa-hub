-- FFSA Platform — Migration 004: Extend Schema
-- Adds new roles, and extends the people table with international/health fields

-- ============================================================
-- New Roles
-- ============================================================

INSERT INTO public.roles (name, display_name, description, is_system)
VALUES
  ('finance_admin', 'Finance Admin', 'Manages staff fees, rent, school fees, and support levels', true),
  ('comms_admin', 'Communications Admin', 'Manages announcements, partner updates, and internal communications', true),
  ('mission_leader', 'Mission Leader', 'Manages outreach trips, visiting teams, and impact statistics', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Extend people table with international / health fields
-- ============================================================

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS passport_country        text,
  ADD COLUMN IF NOT EXISTS passport_number         text,
  ADD COLUMN IF NOT EXISTS visa_type               text,
  ADD COLUMN IF NOT EXISTS visa_expiry_date        date,
  ADD COLUMN IF NOT EXISTS health_insurance_provider      text,
  ADD COLUMN IF NOT EXISTS health_insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS health_insurance_expiry_date   date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name         text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;

-- Add a comment to document the intent of these fields
COMMENT ON COLUMN public.people.passport_country IS 'Country of passport — for international staff visa tracking';
COMMENT ON COLUMN public.people.passport_number IS 'Passport number — sensitive, admin access only';
COMMENT ON COLUMN public.people.visa_type IS 'Current visa type (e.g. tourist, religious worker, study)';
COMMENT ON COLUMN public.people.visa_expiry_date IS 'Date visa expires — used for renewal reminders';
COMMENT ON COLUMN public.people.health_insurance_provider IS 'Health insurance provider name';
COMMENT ON COLUMN public.people.health_insurance_policy_number IS 'Health insurance policy number';
COMMENT ON COLUMN public.people.health_insurance_expiry_date IS 'Health insurance expiry date';
COMMENT ON COLUMN public.people.emergency_contact_name IS 'Emergency contact full name';
COMMENT ON COLUMN public.people.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN public.people.emergency_contact_relationship IS 'Relationship to emergency contact (e.g. parent, spouse)';
