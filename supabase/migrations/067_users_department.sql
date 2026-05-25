-- ============================================================
-- FFSA Hub — Migration 067: Add department to users
-- ============================================================
-- Every user must declare which FFSA department they
-- predominantly belong to. The profile-completion gate
-- (src/components/profile-completion-gate.tsx) detects the
-- missing value and prompts the user on next login.
--
-- Column is nullable on purpose: existing users get filled in
-- by the gate the next time they log in, not by a backfill.
--
-- Allowed values are enforced via CHECK rather than an enum so
-- additions can ship as a plain ALTER TABLE in a later migration
-- without an enum-rename dance.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS department text
    CHECK (department IN (
      'prayer_and_worship',
      'media',
      'hulk',
      'backbone',
      'training',
      'project_54',
      'education',
      'woven'
    ));

COMMENT ON COLUMN public.users.department IS
  'FFSA department the user predominantly serves in. Set via the profile-completion gate on first login. Allowed values: prayer_and_worship, media, hulk, backbone, training, project_54, education, woven.';
