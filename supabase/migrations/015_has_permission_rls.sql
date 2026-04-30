-- ============================================================
-- Add has_permission() function and update outreach RLS
-- to support the new user_permissions system
-- ============================================================

-- New helper: checks if current user has a permission key
CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND p.key = required_permission
  );
$$;

-- Drop and recreate outreach_teams policies to include has_permission
DROP POLICY IF EXISTS "Admins can read all outreach teams" ON public.outreach_teams;
DROP POLICY IF EXISTS "Admins can insert outreach teams" ON public.outreach_teams;
DROP POLICY IF EXISTS "Admins can update outreach teams" ON public.outreach_teams;

CREATE POLICY "Admins can read all outreach teams"
  ON public.outreach_teams FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));

CREATE POLICY "Admins can insert outreach teams"
  ON public.outreach_teams FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'));

CREATE POLICY "Admins can update outreach teams"
  ON public.outreach_teams FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(id));

-- Fix team members policies
DROP POLICY IF EXISTS "Admins can manage team members" ON public.outreach_team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON public.outreach_team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON public.outreach_team_members;

CREATE POLICY "Admins can manage team members"
  ON public.outreach_team_members FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id));

CREATE POLICY "Admins can update team members"
  ON public.outreach_team_members FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id));

CREATE POLICY "Admins can delete team members"
  ON public.outreach_team_members FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id));
