-- ============================================================
-- FFSA Platform — School Fees Schema
-- ============================================================
-- Run AFTER 008_outreach_finance.sql
-- Creates: 4 tables for school fee tracking with tiered pricing
-- Triggers: auto-fee on enrollment, auto-balance on payment
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. COUNTRY TIERS — maps countries to pricing tiers (A/B/C)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.country_tiers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name text NOT NULL UNIQUE,
  tier         text NOT NULL CHECK (tier IN ('A', 'B', 'C')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_country_tiers_tier ON public.country_tiers(tier);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.country_tiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. SCHOOL FEE STRUCTURES — pricing per program per tier
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.school_fee_structures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  tier              text NOT NULL CHECK (tier IN ('A', 'B', 'C')),
  tuition_zar       numeric(12,2) NOT NULL DEFAULT 0,
  accommodation_zar numeric(12,2) NOT NULL DEFAULT 0,
  meals_zar         numeric(12,2) NOT NULL DEFAULT 0,
  materials_zar     numeric(12,2) NOT NULL DEFAULT 0,
  total_zar         numeric(12,2) GENERATED ALWAYS AS (
    tuition_zar + accommodation_zar + meals_zar + materials_zar
  ) STORED,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, tier)
);

CREATE INDEX idx_sfs_program ON public.school_fee_structures(program_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.school_fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. STUDENT FEES — fee record per enrollment
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.student_fees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  program_id        uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  tier              text NOT NULL CHECK (tier IN ('A', 'B', 'C')),
  tier_override     boolean NOT NULL DEFAULT false,
  tuition_zar       numeric(12,2) NOT NULL DEFAULT 0,
  accommodation_zar numeric(12,2) NOT NULL DEFAULT 0,
  meals_zar         numeric(12,2) NOT NULL DEFAULT 0,
  materials_zar     numeric(12,2) NOT NULL DEFAULT 0,
  total_due_zar     numeric(12,2) NOT NULL DEFAULT 0,
  discount_zar      numeric(12,2) NOT NULL DEFAULT 0,
  scholarship_zar   numeric(12,2) NOT NULL DEFAULT 0,
  final_amount_zar  numeric(12,2) GENERATED ALWAYS AS (
    total_due_zar - discount_zar - scholarship_zar
  ) STORED,
  amount_paid_zar   numeric(12,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'waived')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sf_user ON public.student_fees(user_id);
CREATE INDEX idx_sf_program ON public.student_fees(program_id);
CREATE INDEX idx_sf_status ON public.student_fees(status);
CREATE INDEX idx_sf_enrollment ON public.student_fees(enrollment_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. STUDENT PAYMENTS — individual payment records
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.student_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id  uuid NOT NULL REFERENCES public.student_fees(id) ON DELETE CASCADE,
  payment_date    date NOT NULL DEFAULT CURRENT_DATE,
  amount_zar      numeric(12,2) NOT NULL,
  payment_method  text NOT NULL CHECK (payment_method IN ('eft', 'cash', 'card', 'other')),
  reference       text,
  currency_paid   text DEFAULT 'ZAR',
  currency_amount numeric(12,2),
  exchange_rate   numeric(12,6),
  receipt_path    text,
  recorded_by     uuid NOT NULL REFERENCES public.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sp_fee ON public.student_payments(student_fee_id);
CREATE INDEX idx_sp_date ON public.student_payments(payment_date);

-- ────────────────────────────────────────────────────────────
-- 5. AUTO-CREATE STUDENT FEE ON ENROLLMENT
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_create_student_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nationality text;
  v_tier text;
  v_structure record;
BEGIN
  -- Only fire on active enrollments
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Get student nationality
  SELECT nationality INTO v_nationality
  FROM users
  WHERE id = NEW.user_id;

  -- Look up tier from country_tiers
  SELECT tier INTO v_tier
  FROM country_tiers
  WHERE LOWER(country_name) = LOWER(COALESCE(v_nationality, ''));

  -- Default to tier A if nationality not mapped
  IF v_tier IS NULL THEN
    v_tier := 'A';
  END IF;

  -- Get fee structure for this program + tier
  SELECT * INTO v_structure
  FROM school_fee_structures
  WHERE program_id = NEW.program_id AND tier = v_tier;

  -- Only create if a fee structure exists
  IF v_structure IS NOT NULL THEN
    INSERT INTO student_fees (
      enrollment_id, user_id, program_id, tier,
      tuition_zar, accommodation_zar, meals_zar, materials_zar, total_due_zar
    ) VALUES (
      NEW.id, NEW.user_id, NEW.program_id, v_tier,
      v_structure.tuition_zar, v_structure.accommodation_zar,
      v_structure.meals_zar, v_structure.materials_zar,
      v_structure.total_zar
    )
    ON CONFLICT (enrollment_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_student_fee_on_enrollment
  AFTER INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_student_fee();

-- ────────────────────────────────────────────────────────────
-- 6. AUTO-UPDATE BALANCE ON PAYMENT CHANGES
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_student_fee_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_id uuid;
  v_total_paid numeric(12,2);
  v_final_amount numeric(12,2);
  v_new_status text;
  v_current_status text;
BEGIN
  -- Get the fee ID from the triggering row
  v_fee_id := COALESCE(NEW.student_fee_id, OLD.student_fee_id);

  -- Calculate total paid for this fee
  SELECT COALESCE(SUM(amount_zar), 0) INTO v_total_paid
  FROM student_payments
  WHERE student_fee_id = v_fee_id;

  -- Get final amount and current status
  SELECT final_amount_zar, status INTO v_final_amount, v_current_status
  FROM student_fees
  WHERE id = v_fee_id;

  -- Don't override waived status
  IF v_current_status = 'waived' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine new status
  IF v_total_paid >= v_final_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Update the fee record
  UPDATE student_fees
  SET amount_paid_zar = v_total_paid,
      status = v_new_status
  WHERE id = v_fee_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_fee_balance_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.student_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_student_fee_balance();

-- ────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;

-- Country Tiers (reference data — authenticated read)
CREATE POLICY "Authenticated can read country tiers"
  ON public.country_tiers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert country tiers"
  ON public.country_tiers FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can update country tiers"
  ON public.country_tiers FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can delete country tiers"
  ON public.country_tiers FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin'));

-- Fee Structures (reference data — authenticated read)
CREATE POLICY "Authenticated can read fee structures"
  ON public.school_fee_structures FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert fee structures"
  ON public.school_fee_structures FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can update fee structures"
  ON public.school_fee_structures FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can delete fee structures"
  ON public.school_fee_structures FOR DELETE
  USING (public.is_admin() OR public.has_role('finance_admin'));

-- Student Fees (admin read all, students read own)
CREATE POLICY "Admins can read all student fees"
  ON public.student_fees FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Students can read own fees"
  ON public.student_fees FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert student fees"
  ON public.student_fees FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can update student fees"
  ON public.student_fees FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

-- Student Payments (admin read all, students read own)
CREATE POLICY "Admins can read all payments"
  ON public.student_payments FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Students can read own payments"
  ON public.student_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_fees sf
      WHERE sf.id = student_fee_id AND sf.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert payments"
  ON public.student_payments FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can update payments"
  ON public.student_payments FOR UPDATE
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

CREATE POLICY "Admins can delete payments"
  ON public.student_payments FOR DELETE
  USING (public.is_admin());
