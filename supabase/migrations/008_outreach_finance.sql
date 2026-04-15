-- ============================================================
-- FFSA Platform — Outreach Finance Schema
-- ============================================================
-- Run AFTER 007_applications_schema.sql
-- Creates: 9 tables for outreach finance tracking
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. OUTREACH TEAMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_teams (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  team_name         text NOT NULL,
  location          text,
  country           text,
  start_date        date,
  end_date          date,
  status            text NOT NULL DEFAULT 'planning'
                    CHECK (status IN ('planning', 'active', 'review', 'closed')),
  people_count      integer NOT NULL DEFAULT 0,
  total_budget_zar  numeric(12,2) NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'ZAR',
  notes             text,
  drive_folder_url  text,
  created_by        uuid NOT NULL REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_teams_program ON public.outreach_teams(program_id);
CREATE INDEX idx_outreach_teams_status ON public.outreach_teams(status);

-- ────────────────────────────────────────────────────────────
-- 2. OUTREACH TEAM MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_team_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid NOT NULL REFERENCES public.outreach_teams(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'team_member'
            CHECK (role IN (
              'outreach_leader', 'finance_student',
              'school_leader', 'finance_admin', 'team_member'
            )),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX idx_otm_team ON public.outreach_team_members(team_id);
CREATE INDEX idx_otm_user ON public.outreach_team_members(user_id);

-- ────────────────────────────────────────────────────────────
-- 3. BUDGET CATEGORIES (reference data)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_budget_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.outreach_budget_categories (name, slug, is_default, sort_order) VALUES
  ('Flights',           'flights',           true,  1),
  ('Visas',             'visas',             true,  2),
  ('Accommodation',     'accommodation',     true,  3),
  ('Food',              'food',              true,  4),
  ('Transport',         'transport',         true,  5),
  ('Ministry Supplies', 'ministry-supplies', true,  6),
  ('Translator',        'translator',        true,  7),
  ('Emergency Fund',    'emergency-fund',    true,  8),
  ('Airport Meals',     'airport-meals',     true,  9),
  ('Airport Transport', 'airport-transport', true, 10),
  ('First Aid Kit',     'first-aid-kit',     true, 11),
  ('Gifts',             'gifts',             true, 12),
  ('Fun',               'fun',               true, 13),
  ('Bank Costs',        'bank-costs',        true, 14),
  ('Finance Kit',       'finance-kit',       true, 15);

-- ────────────────────────────────────────────────────────────
-- 4. TEAM CATEGORY BUDGETS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_team_budgets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid NOT NULL REFERENCES public.outreach_teams(id) ON DELETE CASCADE,
  category_id       uuid NOT NULL REFERENCES public.outreach_budget_categories(id) ON DELETE CASCADE,
  people_count      integer,
  budget_amount_zar numeric(12,2) NOT NULL DEFAULT 0,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, category_id)
);

CREATE INDEX idx_otb_team ON public.outreach_team_budgets(team_id);

-- ────────────────────────────────────────────────────────────
-- 5. FUND RELEASES (payouts)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_fund_releases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES public.outreach_teams(id) ON DELETE CASCADE,
  label         text NOT NULL,
  release_date  date NOT NULL DEFAULT CURRENT_DATE,
  amount_zar    numeric(12,2) NOT NULL,
  currency      text NOT NULL DEFAULT 'ZAR',
  method        text NOT NULL DEFAULT 'bank_transfer'
                CHECK (method IN ('bank_transfer', 'cash')),
  recipient     text,
  notes         text,
  created_by    uuid NOT NULL REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ofr_team ON public.outreach_fund_releases(team_id);

-- ────────────────────────────────────────────────────────────
-- 6. CASH BATCHES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_cash_batches (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                 uuid NOT NULL REFERENCES public.outreach_teams(id) ON DELETE CASCADE,
  batch_date              date NOT NULL DEFAULT CURRENT_DATE,
  zar_withdrawn           numeric(12,2) NOT NULL,
  bank_fee                numeric(12,2) NOT NULL DEFAULT 0,
  local_currency          text NOT NULL,
  local_currency_received numeric(12,2) NOT NULL,
  exchange_rate           numeric(12,6) NOT NULL,
  notes                   text,
  created_by              uuid NOT NULL REFERENCES public.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocb_team ON public.outreach_cash_batches(team_id);

-- ────────────────────────────────────────────────────────────
-- 7. EXPENSES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES public.outreach_teams(id) ON DELETE CASCADE,
  category_id     uuid NOT NULL REFERENCES public.outreach_budget_categories(id),
  expense_date    date NOT NULL DEFAULT CURRENT_DATE,
  receipt_code    text,
  vendor          text,
  description     text NOT NULL,
  purchaser       text,
  payment_method  text NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN (
                    'cash', 'card', 'bank_transfer', 'reimbursement', 'prepayment'
                  )),
  country         text,
  local_currency  text NOT NULL DEFAULT 'ZAR',
  local_amount    numeric(12,2) NOT NULL,
  zar_amount      numeric(12,2) NOT NULL,
  exchange_rate   numeric(12,6) NOT NULL DEFAULT 1,
  cash_batch_id   uuid REFERENCES public.outreach_cash_batches(id) ON DELETE SET NULL,
  receipt_path    text,
  notes           text,
  created_by      uuid NOT NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oe_team ON public.outreach_expenses(team_id);
CREATE INDEX idx_oe_category ON public.outreach_expenses(category_id);
CREATE INDEX idx_oe_cash_batch ON public.outreach_expenses(cash_batch_id) WHERE cash_batch_id IS NOT NULL;
CREATE INDEX idx_oe_date ON public.outreach_expenses(expense_date);

-- ────────────────────────────────────────────────────────────
-- 8. RECEIPTS (file metadata)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid NOT NULL REFERENCES public.outreach_expenses(id) ON DELETE CASCADE,
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  file_size   integer,
  mime_type   text,
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_or_expense ON public.outreach_receipts(expense_id);

-- ────────────────────────────────────────────────────────────
-- 9. CLOSEOUTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.outreach_closeouts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid NOT NULL REFERENCES public.outreach_teams(id) ON DELETE CASCADE,
  total_funds_sent  numeric(12,2) NOT NULL DEFAULT 0,
  total_spent       numeric(12,2) NOT NULL DEFAULT 0,
  cash_remaining    numeric(12,2) NOT NULL DEFAULT 0,
  funds_returned    numeric(12,2) NOT NULL DEFAULT 0,
  variance          numeric(12,2) NOT NULL DEFAULT 0,
  variance_pct      numeric(5,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'auto_closed', 'admin_override', 'rejected')),
  admin_notes       text,
  closed_by         uuid REFERENCES public.users(id),
  closed_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outreach_teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outreach_team_budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outreach_fund_releases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outreach_cash_batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outreach_expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outreach_closeouts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Check if current user is a member of a specific outreach team
CREATE OR REPLACE FUNCTION public.is_outreach_team_member(check_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outreach_team_members
    WHERE team_id = check_team_id AND user_id = auth.uid()
  );
$$;

-- Check if current user has finance admin access to a team
CREATE OR REPLACE FUNCTION public.is_outreach_finance_admin(check_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outreach_team_members
    WHERE team_id = check_team_id
      AND user_id = auth.uid()
      AND role IN ('finance_admin', 'school_leader')
  ) OR public.is_admin()
    OR public.has_role('finance_admin');
$$;

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.outreach_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_team_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_fund_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_cash_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_closeouts ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS: OUTREACH TEAMS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all outreach teams"
  ON public.outreach_teams FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Team members can read their team"
  ON public.outreach_teams FOR SELECT USING (public.is_outreach_team_member(id));
CREATE POLICY "Admins can insert outreach teams"
  ON public.outreach_teams FOR INSERT WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Admins can update outreach teams"
  ON public.outreach_teams FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(id));

-- ────────────────────────────────────────────────────────────
-- RLS: TEAM MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all team members"
  ON public.outreach_team_members FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team members"
  ON public.outreach_team_members FOR SELECT USING (public.is_outreach_team_member(team_id));
CREATE POLICY "Admins can manage team members"
  ON public.outreach_team_members FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id));
CREATE POLICY "Admins can update team members"
  ON public.outreach_team_members FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id));
CREATE POLICY "Admins can delete team members"
  ON public.outreach_team_members FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id));

-- ────────────────────────────────────────────────────────────
-- RLS: BUDGET CATEGORIES (reference data — all authenticated can read)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read budget categories"
  ON public.outreach_budget_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage budget categories"
  ON public.outreach_budget_categories FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update budget categories"
  ON public.outreach_budget_categories FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete budget categories"
  ON public.outreach_budget_categories FOR DELETE USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- RLS: TEAM BUDGETS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all team budgets"
  ON public.outreach_team_budgets FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team budgets"
  ON public.outreach_team_budgets FOR SELECT USING (public.is_outreach_team_member(team_id));
CREATE POLICY "Admins can insert team budgets"
  ON public.outreach_team_budgets FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id));
CREATE POLICY "Admins can update team budgets"
  ON public.outreach_team_budgets FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_finance_admin(team_id));
CREATE POLICY "Admins can delete team budgets"
  ON public.outreach_team_budgets FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin'));

-- ────────────────────────────────────────────────────────────
-- RLS: FUND RELEASES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all fund releases"
  ON public.outreach_fund_releases FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team fund releases"
  ON public.outreach_fund_releases FOR SELECT USING (public.is_outreach_team_member(team_id));
CREATE POLICY "Admins can insert fund releases"
  ON public.outreach_fund_releases FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Admins can update fund releases"
  ON public.outreach_fund_releases FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

-- ────────────────────────────────────────────────────────────
-- RLS: CASH BATCHES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all cash batches"
  ON public.outreach_cash_batches FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team cash batches"
  ON public.outreach_cash_batches FOR SELECT USING (public.is_outreach_team_member(team_id));
CREATE POLICY "Team leaders can insert cash batches"
  ON public.outreach_cash_batches FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id));
CREATE POLICY "Team leaders can update cash batches"
  ON public.outreach_cash_batches FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id));

-- ────────────────────────────────────────────────────────────
-- RLS: EXPENSES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all expenses"
  ON public.outreach_expenses FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team expenses"
  ON public.outreach_expenses FOR SELECT USING (public.is_outreach_team_member(team_id));
CREATE POLICY "Members can insert expenses"
  ON public.outreach_expenses FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id));
CREATE POLICY "Members can update expenses"
  ON public.outreach_expenses FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id));
CREATE POLICY "Members can delete expenses"
  ON public.outreach_expenses FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.is_outreach_team_member(team_id));

-- ────────────────────────────────────────────────────────────
-- RLS: RECEIPTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all receipts"
  ON public.outreach_receipts FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team receipts"
  ON public.outreach_receipts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.outreach_expenses e
    WHERE e.id = expense_id AND public.is_outreach_team_member(e.team_id)
  ));
CREATE POLICY "Members can insert receipts"
  ON public.outreach_receipts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outreach_expenses e
    WHERE e.id = expense_id AND public.is_outreach_team_member(e.team_id)
  ) OR public.is_admin() OR public.has_role('finance_admin'));

-- ────────────────────────────────────────────────────────────
-- RLS: CLOSEOUTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can read all closeouts"
  ON public.outreach_closeouts FOR SELECT USING (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Members can read their team closeout"
  ON public.outreach_closeouts FOR SELECT USING (public.is_outreach_team_member(team_id));
CREATE POLICY "Admins can manage closeouts"
  ON public.outreach_closeouts FOR INSERT WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));
CREATE POLICY "Admins can update closeouts"
  ON public.outreach_closeouts FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKET (private receipts)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('outreach-receipts', 'outreach-receipts', false)
ON CONFLICT (id) DO NOTHING;
