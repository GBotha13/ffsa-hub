-- ============================================================
-- FFSA Platform — Reference System for Applications
-- ============================================================
-- Run AFTER 019_program_archive_delete.sql
-- Creates: reference_slots, reference_requests
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- REFERENCE SLOTS (configurable per program)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reference_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  label         text NOT NULL,
  description   text,
  sort_order    integer NOT NULL DEFAULT 0,
  is_required   boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reference_slots_program ON public.reference_slots(program_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reference_slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- REFERENCE REQUESTS (one per referee per application)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reference_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      uuid NOT NULL REFERENCES public.application_responses(id) ON DELETE CASCADE,
  slot_id             uuid NOT NULL REFERENCES public.reference_slots(id) ON DELETE CASCADE,
  referee_name        text NOT NULL,
  referee_email       text NOT NULL,
  token               text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'submitted')),
  relationship        text,
  known_duration      text,
  reference_text      text,
  submitted_at        timestamptz,
  email_sent_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, slot_id)
);

CREATE INDEX idx_reference_requests_application ON public.reference_requests(application_id);
CREATE INDEX idx_reference_requests_token ON public.reference_requests(token);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reference_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS — REFERENCE SLOTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.reference_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reference slots"
  ON public.reference_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert reference slots"
  ON public.reference_slots FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update reference slots"
  ON public.reference_slots FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete reference slots"
  ON public.reference_slots FOR DELETE
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- RLS — REFERENCE REQUESTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.reference_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all reference requests"
  ON public.reference_requests FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Users can read own reference requests"
  ON public.reference_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.application_responses ar
      WHERE ar.id = reference_requests.application_id
      AND ar.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert reference requests"
  ON public.reference_requests FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update reference requests"
  ON public.reference_requests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
