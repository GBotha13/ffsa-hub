-- ============================================================
-- FFSA Hub — Role engine (Phase 2 of permissions redesign)
-- ============================================================
-- Roles (job titles) become reusable, stackable bundles of
-- permissions. A user's effective access = their direct
-- user_permissions  UNION  the permissions carried by every role
-- assigned to them (user_roles -> role_permissions), respecting
-- the scope on each role assignment.
--
-- Built ON TOP of the existing "keep every key and make RLS honor
-- it" foundation (migrations 081/086/087) — this is purely
-- additive. has_permission() gains a second branch for role-derived
-- grants; because no role has any role_permissions rows yet, that
-- branch matches nothing and NO existing user's access changes until
-- bundles are populated.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. New capability: who may manage roles & access (seeded now,
--    wired to the Roles screen in Phase 3). Unassigned on purpose.
-- ────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module, key, display_name, sort_order) VALUES
  ('administration', 'administration.manage_roles', 'Manage Roles & Access', 10)
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. role_permissions — the bundle definition (role -> capability)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role       ON public.role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions (permission_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (needed for access resolution + the UI).
CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Writable by super_admin only for now. Phase 3 widens this to holders of
-- administration.manage_roles, with the "can only grant what you hold"
-- guardrail enforced at the API layer.
CREATE POLICY "role_permissions_write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. has_permission(key) — now role-aware (direct OR via any role)
--    Original body (migration 015) preserved as the first branch.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- direct grant
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND p.key = required_permission
  )
  OR EXISTS (
    -- granted via an assigned role's bundle
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.key = required_permission
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 4. has_permission_for(key, program_id) — role-aware + scope-aware.
--    A role assigned globally (scope NULL) grants everywhere; a role
--    assigned to a program grants only for that program. Mirrors the
--    direct-grant scope rule from migration 040.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission_for(
  required_permission text,
  target_program_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- direct grant (global or scoped to this program)
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND p.key = required_permission
      AND (
        up.scope_type IS NULL
        OR (up.scope_type = 'program' AND up.scope_id = target_program_id)
      )
  )
  OR EXISTS (
    -- granted via an assigned role's bundle (global or scoped to this program)
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.key = required_permission
      AND (
        ur.scope_type IS NULL
        OR (ur.scope_type = 'program' AND ur.scope_id = target_program_id)
      )
  );
$$;
