-- Fix RLS on all outreach finance tables to accept has_permission()
-- Migration 015 only updated outreach_teams and outreach_team_members;
-- all other tables still blocked non-admin permission holders.

-- TEAM BUDGETS
DROP POLICY IF EXISTS "Admins can read all team budgets" ON public.outreach_team_budgets;
DROP POLICY IF EXISTS "Admins can insert team budgets" ON public.outreach_team_budgets;
DROP POLICY IF EXISTS "Admins can update team budgets" ON public.outreach_team_budgets;
DROP POLICY IF EXISTS "Admins can delete team budgets" ON public.outreach_team_budgets;

CREATE POLICY "Admins can read all team budgets"
  ON public.outreach_team_budgets FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));
CREATE POLICY "Admins can insert team budgets"
  ON public.outreach_team_budgets FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id));
CREATE POLICY "Admins can update team budgets"
  ON public.outreach_team_budgets FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_finance_admin(team_id));
CREATE POLICY "Admins can delete team budgets"
  ON public.outreach_team_budgets FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'));

-- EXPENSES
DROP POLICY IF EXISTS "Admins can read all expenses" ON public.outreach_expenses;
DROP POLICY IF EXISTS "Members can insert expenses" ON public.outreach_expenses;
DROP POLICY IF EXISTS "Members can update expenses" ON public.outreach_expenses;
DROP POLICY IF EXISTS "Members can delete expenses" ON public.outreach_expenses;

CREATE POLICY "Admins can read all expenses"
  ON public.outreach_expenses FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));
CREATE POLICY "Members can insert expenses"
  ON public.outreach_expenses FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id));
CREATE POLICY "Members can update expenses"
  ON public.outreach_expenses FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id));
CREATE POLICY "Members can delete expenses"
  ON public.outreach_expenses FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id));

-- FUND RELEASES
DROP POLICY IF EXISTS "Admins can read all fund releases" ON public.outreach_fund_releases;
DROP POLICY IF EXISTS "Admins can insert fund releases" ON public.outreach_fund_releases;
DROP POLICY IF EXISTS "Admins can update fund releases" ON public.outreach_fund_releases;

CREATE POLICY "Admins can read all fund releases"
  ON public.outreach_fund_releases FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));
CREATE POLICY "Admins can insert fund releases"
  ON public.outreach_fund_releases FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'));
CREATE POLICY "Admins can update fund releases"
  ON public.outreach_fund_releases FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'));

-- CASH BATCHES
DROP POLICY IF EXISTS "Admins can read all cash batches" ON public.outreach_cash_batches;
DROP POLICY IF EXISTS "Team leaders can insert cash batches" ON public.outreach_cash_batches;
DROP POLICY IF EXISTS "Team leaders can update cash batches" ON public.outreach_cash_batches;

CREATE POLICY "Admins can read all cash batches"
  ON public.outreach_cash_batches FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));
CREATE POLICY "Team leaders can insert cash batches"
  ON public.outreach_cash_batches FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id));
CREATE POLICY "Team leaders can update cash batches"
  ON public.outreach_cash_batches FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit') OR public.is_outreach_team_member(team_id));

-- RECEIPTS
DROP POLICY IF EXISTS "Admins can read all receipts" ON public.outreach_receipts;

CREATE POLICY "Admins can read all receipts"
  ON public.outreach_receipts FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));

-- CLOSEOUTS
DROP POLICY IF EXISTS "Admins can read all closeouts" ON public.outreach_closeouts;
DROP POLICY IF EXISTS "Admins can manage closeouts" ON public.outreach_closeouts;
DROP POLICY IF EXISTS "Admins can update closeouts" ON public.outreach_closeouts;

CREATE POLICY "Admins can read all closeouts"
  ON public.outreach_closeouts FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.view') OR public.has_permission('finance.edit'));
CREATE POLICY "Admins can manage closeouts"
  ON public.outreach_closeouts FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'));
CREATE POLICY "Admins can update closeouts"
  ON public.outreach_closeouts FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.has_permission('finance.edit'));
