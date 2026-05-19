-- ============================================================
-- FFSA Hub — Staff assignments for applications & enrollments
-- ============================================================
-- A staff member can be assigned to each application and to each
-- enrollment. The two assignments are intentionally INDEPENDENT —
-- a staff member does not auto-follow an applicant into enrollment.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- APPLICATION_RESPONSES — assigned staff
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_responses
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_assigned_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_viewed_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_application_responses_assigned_staff
  ON public.application_responses(assigned_staff_id)
  WHERE assigned_staff_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- ENROLLMENTS — assigned staff (independent of the application)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_assigned_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_viewed_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_enrollments_assigned_staff
  ON public.enrollments(assigned_staff_id)
  WHERE assigned_staff_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- RLS — allow assigned staff to read their own assignments and
-- to update the staff_viewed_at field on them. Existing admin /
-- schools-manager policies continue to govern everything else.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Assigned staff can read their application_responses"
  ON public.application_responses;
CREATE POLICY "Assigned staff can read their application_responses"
  ON public.application_responses FOR SELECT
  USING (assigned_staff_id = auth.uid());

DROP POLICY IF EXISTS "Assigned staff can read their enrollments"
  ON public.enrollments;
CREATE POLICY "Assigned staff can read their enrollments"
  ON public.enrollments FOR SELECT
  USING (assigned_staff_id = auth.uid());
