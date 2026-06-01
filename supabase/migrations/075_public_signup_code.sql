-- ============================================================
-- FFSA Hub — Migration 075: Public signup code + remove approval gate
-- ============================================================
-- Two changes:
--
--   1. public_signup_settings  — singleton table that holds the
--      org-wide shareable signup code. Superadmins regenerate
--      from /admin/users; anyone with the active code can
--      self-onboard via /join/<code>.
--
--   2. Auto-approve flow — users that finish onboarding now go
--      straight to status='active' instead of 'pending_approval'.
--      Existing pending_approval rows are flipped to 'active' so
--      no one is stranded behind the removed gate.
--
-- Additive on the table side; one bulk UPDATE on existing data.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. public_signup_settings  (singleton)
-- ------------------------------------------------------------
-- One row, enforced by the PK (id=1). The active 'code' is the
-- segment that appears in /join/<code> URLs. Regenerating swaps
-- the code in place — old links stop working immediately.
--
-- 'enabled' lets a superadmin pause public signup without
-- destroying the current code.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.public_signup_settings (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  code            text NOT NULL UNIQUE,
  enabled         boolean NOT NULL DEFAULT true,
  regenerated_at  timestamptz NOT NULL DEFAULT now(),
  regenerated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.public_signup_settings IS
  'Singleton row holding the active org-wide public signup code. Used by /join/<code> for self-onboarding.';

-- Seed the initial row with a random 24-char URL-safe code.
-- gen_random_uuid() → hex → strip dashes → first 24 chars.
INSERT INTO public.public_signup_settings (id, code, enabled)
VALUES (
  1,
  substring(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  true
);

ALTER TABLE public.public_signup_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read or write the code via the user session.
-- Public code validation goes through the admin Supabase client
-- (service role bypasses RLS) on the /api/public/signup route.
CREATE POLICY "super_admin reads signup settings"
  ON public.public_signup_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "super_admin writes signup settings"
  ON public.public_signup_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. Auto-approve existing pending users
-- ------------------------------------------------------------
-- The PendingApprovalGate is being removed in this release.
-- Anyone left in 'pending_approval' would otherwise be stuck
-- behind a gate that no longer renders meaningfully — move them
-- to 'active' so they get base self_service access.
-- ────────────────────────────────────────────────────────────

UPDATE public.users
SET status = 'active'
WHERE status = 'pending_approval';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT id, length(code), enabled FROM public.public_signup_settings;
--   -- expect: 1 | 24 | true
--
--   SELECT count(*) FROM public.users WHERE status = 'pending_approval';
--   -- expect: 0
-- ============================================================
