-- ============================================================
-- FFSA Hub — Migration 060: Records Library Schema
-- ============================================================
-- The Records Library lets super admins (or anyone granted the
-- manage_records_library permission) upload CSV files of
-- historical staff/student data — applications, payments,
-- school enrollments, passport/insurance documents — into a
-- pool of "person records" that exist independently of any
-- user account.
--
-- When a user later signs up, a matching engine looks for a
-- person record with the same normalized email + last name and
-- auto-links every related record (applications, payments,
-- etc.) to that user's profile. Fuzzier matches land in a
-- review queue.
--
-- Design notes:
--   * Each record type stores a small set of typed "core"
--     columns used for matching, display, and filtering. The
--     full original CSV row lives in `raw_data` JSONB so new
--     CSVs with new columns never require a schema migration.
--   * `library_persons.email_normalized` is generated; phone
--     is normalized at the application layer (E.164) — same
--     pattern as `contacts` (migration 041).
--   * Distinct from the CRM `csv_imports` table (migration 047)
--     because the domain, RLS, and consumers differ.
--
-- Append-only. No data destruction.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. library_imports — one row per CSV upload
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_imports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename            text NOT NULL,
  record_type         text NOT NULL
    CHECK (record_type IN ('application', 'payment', 'enrollment', 'document')),
  template_id         uuid,
  column_mapping      jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count           integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  persons_created     integer NOT NULL DEFAULT 0,
  records_created     integer NOT NULL DEFAULT 0,
  auto_linked_count   integer NOT NULL DEFAULT 0,
  queued_count        integer NOT NULL DEFAULT 0,
  error_count         integer NOT NULL DEFAULT 0,
  error_log           jsonb,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE INDEX idx_library_imports_status      ON public.library_imports (status);
CREATE INDEX idx_library_imports_record_type ON public.library_imports (record_type);
CREATE INDEX idx_library_imports_created     ON public.library_imports (created_at DESC);

COMMENT ON TABLE public.library_imports IS
  'Per-upload record of Records Library CSV imports. Tracks counts, mapping used, and errors. Distinct from CRM csv_imports.';

COMMENT ON COLUMN public.library_imports.column_mapping IS
  'JSONB object: { "<csv_column_name>": "<core_field>" | "raw" }. "raw" means the column goes into the row''s raw_data blob.';

-- ────────────────────────────────────────────────────────────
-- 2. library_templates — saved column mappings for reuse
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  record_type    text NOT NULL
    CHECK (record_type IN ('application', 'payment', 'enrollment', 'document')),
  column_mapping jsonb NOT NULL,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, record_type)
);

CREATE INDEX idx_library_templates_record_type ON public.library_templates (record_type);

ALTER TABLE public.library_imports
  ADD CONSTRAINT library_imports_template_fk
  FOREIGN KEY (template_id) REFERENCES public.library_templates(id) ON DELETE SET NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.library_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.library_templates IS
  'Reusable column-to-field mapping templates. After importing a CSV once, the mapping can be saved and reapplied to future uploads of the same form.';

-- ────────────────────────────────────────────────────────────
-- 3. library_persons — the "person record" library entry
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_persons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text,
  email_normalized    text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  first_name          text,
  last_name           text,
  preferred_name      text,
  date_of_birth       date,
  phone               text,
  phone_normalized    text
    CHECK (phone_normalized IS NULL OR phone_normalized ~ '^\+[1-9][0-9]{6,14}$'),
  nationality         text,
  country             text,
  linked_user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  linked_at           timestamptz,
  linked_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  link_method         text CHECK (link_method IS NULL OR link_method IN ('auto', 'manual', 'queue_approval')),
  source_import_id    uuid REFERENCES public.library_imports(id) ON DELETE SET NULL,
  raw_data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_persons_email_normalized
  ON public.library_persons (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX idx_library_persons_last_name_lower
  ON public.library_persons (lower(last_name))
  WHERE last_name IS NOT NULL;

CREATE INDEX idx_library_persons_dob
  ON public.library_persons (date_of_birth)
  WHERE date_of_birth IS NOT NULL;

CREATE INDEX idx_library_persons_linked_user
  ON public.library_persons (linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX idx_library_persons_unlinked
  ON public.library_persons (created_at DESC)
  WHERE linked_user_id IS NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.library_persons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.library_persons IS
  'Persons extracted from CSV uploads, awaiting (or already) link to a user account. Matching key: email_normalized + lower(last_name), with DOB as tiebreaker.';

-- ────────────────────────────────────────────────────────────
-- 4. library_applications — historical school applications
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id         uuid NOT NULL REFERENCES public.library_persons(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  import_id         uuid REFERENCES public.library_imports(id) ON DELETE SET NULL,
  program_name      text,
  cohort            text,
  status            text,
  submitted_at      timestamptz,
  raw_data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_applications_person ON public.library_applications (person_id);
CREATE INDEX idx_library_applications_user   ON public.library_applications (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_library_applications_import ON public.library_applications (import_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.library_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.library_applications IS
  'Historical school application records. user_id is null until the parent library_person is linked to a user account.';

-- ────────────────────────────────────────────────────────────
-- 5. library_payments — historical payments
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES public.library_persons(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  import_id       uuid REFERENCES public.library_imports(id) ON DELETE SET NULL,
  amount          numeric(12, 2),
  currency        text,
  description     text,
  paid_at         date,
  raw_data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_payments_person ON public.library_payments (person_id);
CREATE INDEX idx_library_payments_user   ON public.library_payments (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_library_payments_import ON public.library_payments (import_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.library_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.library_payments IS
  'Historical payment records (school fees, donations, deposits). Currency kept as free-text since historical CSVs can be inconsistent.';

-- ────────────────────────────────────────────────────────────
-- 6. library_enrollments — historical schools attended
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES public.library_persons(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  import_id     uuid REFERENCES public.library_imports(id) ON DELETE SET NULL,
  school_name   text,
  program_name  text,
  role          text,
  start_date    date,
  end_date      date,
  raw_data      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_enrollments_person ON public.library_enrollments (person_id);
CREATE INDEX idx_library_enrollments_user   ON public.library_enrollments (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_library_enrollments_import ON public.library_enrollments (import_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.library_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.library_enrollments IS
  'Historical school attendance records (e.g. previous DTS, previous staff seasons).';

-- ────────────────────────────────────────────────────────────
-- 7. library_documents — passport/insurance/etc.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id      uuid NOT NULL REFERENCES public.library_persons(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  import_id      uuid REFERENCES public.library_imports(id) ON DELETE SET NULL,
  doc_type       text,
  file_url       text,
  identifier     text,
  expires_at     date,
  raw_data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_documents_person ON public.library_documents (person_id);
CREATE INDEX idx_library_documents_user   ON public.library_documents (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_library_documents_import ON public.library_documents (import_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.library_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.library_documents IS
  'Important documents associated with a person record: passport copies, insurance copies, certificates, etc. file_url points at Supabase Storage when present.';

-- ────────────────────────────────────────────────────────────
-- 8. library_match_queue — pending matches awaiting review
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.library_match_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid NOT NULL REFERENCES public.library_persons(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_reason     text NOT NULL,
  confidence       text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, user_id)
);

CREATE INDEX idx_library_match_queue_status   ON public.library_match_queue (status);
CREATE INDEX idx_library_match_queue_user     ON public.library_match_queue (user_id);
CREATE INDEX idx_library_match_queue_created  ON public.library_match_queue (created_at DESC);

COMMENT ON TABLE public.library_match_queue IS
  'Possible person-to-user matches that did not meet the auto-link bar. Super admins review and approve/reject. Approving links the person and cascades to all child records.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.library_imports;       -- 0
--   SELECT count(*) FROM public.library_templates;     -- 0
--   SELECT count(*) FROM public.library_persons;       -- 0
--   SELECT count(*) FROM public.library_applications;  -- 0
--   SELECT count(*) FROM public.library_payments;      -- 0
--   SELECT count(*) FROM public.library_enrollments;   -- 0
--   SELECT count(*) FROM public.library_documents;     -- 0
--   SELECT count(*) FROM public.library_match_queue;   -- 0
-- ============================================================
