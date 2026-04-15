-- ============================================================
-- FFSA Platform — Schools Module Schema
-- ============================================================
-- Run AFTER 005_contacts_restructure.sql
-- Creates: programs, courses, enrollments, grades
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PROGRAMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.programs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  code          text UNIQUE NOT NULL,
  description   text,
  credit_hours  integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
  created_by    uuid NOT NULL REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- COURSES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name          text NOT NULL,
  code          text NOT NULL,
  description   text,
  credit_hours  integer NOT NULL DEFAULT 3,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, code)
);

-- ────────────────────────────────────────────────────────────
-- ENROLLMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  program_id    uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'withdrawn', 'on_hold')),
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  enrolled_by   uuid REFERENCES public.users(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);

-- ────────────────────────────────────────────────────────────
-- GRADES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.grades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  letter_grade  text CHECK (letter_grade IN (
    'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-',
    'D+', 'D', 'D-', 'F', 'W', 'I', 'P'
  )),
  graded_by     uuid REFERENCES public.users(id),
  graded_at     timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, course_id)
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_courses_program ON public.courses(program_id);
CREATE INDEX idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_program ON public.enrollments(program_id);
CREATE INDEX idx_grades_enrollment ON public.grades(enrollment_id);
CREATE INDEX idx_grades_course ON public.grades(course_id);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- GPA HELPER FUNCTION
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grade_to_points(grade text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE grade
    WHEN 'A'  THEN 4.0
    WHEN 'A-' THEN 3.7
    WHEN 'B+' THEN 3.3
    WHEN 'B'  THEN 3.0
    WHEN 'B-' THEN 2.7
    WHEN 'C+' THEN 2.3
    WHEN 'C'  THEN 2.0
    WHEN 'C-' THEN 1.7
    WHEN 'D+' THEN 1.3
    WHEN 'D'  THEN 1.0
    WHEN 'D-' THEN 0.7
    WHEN 'F'  THEN 0.0
    ELSE NULL
  END;
$$;

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — PROGRAMS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read active programs"
  ON public.programs FOR SELECT
  USING (auth.uid() IS NOT NULL AND status = 'active');

CREATE POLICY "Admins can read all programs"
  ON public.programs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert programs"
  ON public.programs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update programs"
  ON public.programs FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — COURSES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read courses"
  ON public.courses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update courses"
  ON public.courses FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — ENROLLMENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Users can read own enrollments"
  ON public.enrollments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all enrollments"
  ON public.enrollments FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update enrollments"
  ON public.enrollments FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES — GRADES
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Users can read own grades"
  ON public.grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = enrollment_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all grades"
  ON public.grades FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert grades"
  ON public.grades FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update grades"
  ON public.grades FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
