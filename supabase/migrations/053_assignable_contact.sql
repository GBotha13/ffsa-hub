-- ============================================================
-- FFSA Hub — Make users explicitly assignable as student contacts
-- ============================================================
-- Decouples "can be a point of contact for applicants/enrolled
-- students" from the heavy admin/staff roles. Super admins can flip
-- this on for any user from the user detail page.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_assignable_contact boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_assignable_contact
  ON public.users(is_assignable_contact)
  WHERE is_assignable_contact = true;

-- Backfill: anyone already holding a staff-like role becomes assignable
-- so existing admins and program leaders don't have to be manually
-- toggled on. Idempotent.
UPDATE public.users u
SET is_assignable_contact = true
WHERE u.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name IN ('super_admin', 'admin', 'program_leader', 'staff')
  );
