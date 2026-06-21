-- Prayer Room — "evaluator" becomes an app-level permission.
--
-- Previously evaluator status was a per-member toggle
-- (prayer_room_members.is_evaluator) managed inside the prayer room module.
-- It now lives in the central permissions section like every other capability.
--
-- This migration:
--   1. adds the `prayer_room.evaluate` permission (auto-listed in the
--      permission manager under "Prayer Room"),
--   2. adds a helper to list everyone who holds a permission, whether granted
--      directly or via an assigned role (mirrors has_permission's two sources),
--   3. backfills the grant for anyone currently flagged is_evaluator so no
--      existing evaluator loses access.
--
-- The is_evaluator column is intentionally LEFT in place (deprecated, no longer
-- read or written) so the change stays reversible.

-- ────────────────────────────────────────────────────────────
-- 1. the permission (idempotent)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module, key, display_name, sort_order)
VALUES ('prayer-room', 'prayer_room.evaluate', 'Evaluate Prayer Room Applicants', 20)
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. helper: user ids holding a permission (direct grant OR via a role)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.users_with_permission(required_permission text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT up.user_id
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
   WHERE p.key = required_permission
  UNION
  SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
   WHERE p.key = required_permission;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. backfill: existing evaluators keep access via the new permission
--    (NOT EXISTS guard keeps it safe to re-run; the unique constraint treats
--     NULL scope columns as distinct, so ON CONFLICT can't be relied on here)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.user_permissions (user_id, permission_id)
SELECT m.user_id, p.id
  FROM public.prayer_room_members m
  CROSS JOIN public.permissions p
 WHERE m.is_evaluator = true
   AND p.key = 'prayer_room.evaluate'
   AND NOT EXISTS (
     SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = m.user_id
        AND up.permission_id = p.id
        AND up.scope_type IS NULL
        AND up.scope_id IS NULL
   );
