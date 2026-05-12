-- ============================================================
-- Application Templates — reusable question sets
-- ============================================================

CREATE TABLE public.application_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.application_template_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.application_templates(id) ON DELETE CASCADE,
  label       text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'short_answer',
  sort_order  integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  options     jsonb DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_questions_template
  ON public.application_template_questions(template_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.application_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.application_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_template_questions ENABLE ROW LEVEL SECURITY;

-- Templates: readable by anyone with schools access, writable by admins/schools managers
CREATE POLICY "Schools access can read templates"
  ON public.application_templates FOR SELECT
  USING (public.has_schools_access());

CREATE POLICY "Schools access can insert templates"
  ON public.application_templates FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools access can update templates"
  ON public.application_templates FOR UPDATE
  USING (public.has_schools_access())
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools access can delete templates"
  ON public.application_templates FOR DELETE
  USING (public.has_schools_access());

-- Template questions: same access as templates
CREATE POLICY "Schools access can read template questions"
  ON public.application_template_questions FOR SELECT
  USING (public.has_schools_access());

CREATE POLICY "Schools access can insert template questions"
  ON public.application_template_questions FOR INSERT
  WITH CHECK (public.has_schools_access());

CREATE POLICY "Schools access can delete template questions"
  ON public.application_template_questions FOR DELETE
  USING (public.has_schools_access());
