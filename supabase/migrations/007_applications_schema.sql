-- ============================================================
-- FFSA Platform — School Applications Schema
-- ============================================================
-- Run AFTER 006_schools_schema.sql
-- Creates: application_questions, application_responses
-- Adds: application_open column to programs
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ADD application_open FLAG TO PROGRAMS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS application_open boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- APPLICATION QUESTIONS (form builder)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.application_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  label         text NOT NULL,
  description   text,
  type          text NOT NULL DEFAULT 'short_answer'
                CHECK (type IN ('short_answer', 'long_answer')),
  sort_order    integer NOT NULL DEFAULT 0,
  is_required   boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- APPLICATION RESPONSES (submitted applications)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.application_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answers       jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted', 'accepted', 'rejected', 'waitlisted')),
  reviewed_by   uuid REFERENCES public.users(id),
  reviewed_at   timestamptz,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_app_questions_program ON public.application_questions(program_id);
CREATE INDEX idx_app_responses_program ON public.application_responses(program_id);
CREATE INDEX idx_app_responses_user ON public.application_responses(user_id);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.application_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.application_responses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_responses ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — APPLICATION QUESTIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read application questions"
  ON public.application_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert application questions"
  ON public.application_questions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update application questions"
  ON public.application_questions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete application questions"
  ON public.application_questions FOR DELETE
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — APPLICATION RESPONSES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Users can read own application responses"
  ON public.application_responses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all application responses"
  ON public.application_responses FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Authenticated users can submit own applications"
  ON public.application_responses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update application responses"
  ON public.application_responses FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
