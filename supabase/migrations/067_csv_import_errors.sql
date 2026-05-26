-- 067_csv_import_errors.sql
-- Captures per-row failures from CSV contact imports so admins can
-- review, fix-and-retry, or dismiss them in the UI.
--
-- Previously the importer only incremented csv_imports.error_count;
-- the actual row data and error reason were thrown away after each
-- batch. This table is the audit log + the worklist for the
-- /contacts/imports/[id]/errors page.

CREATE TABLE IF NOT EXISTS public.csv_import_errors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id            uuid NOT NULL REFERENCES public.csv_imports(id) ON DELETE CASCADE,
  row_index            integer NOT NULL,
  raw_row              jsonb NOT NULL,
  error_message        text NOT NULL,
  error_code           text NOT NULL DEFAULT 'unknown'
    CHECK (error_code IN (
      'missing_contact_method',     -- raw row had no email AND no phone
      'no_valid_identifier',        -- after normalization, neither email nor phone usable
      'invalid_phone_format',       -- DB rejected phone_normalized regex
      'invalid_email_format',       -- DB rejected email_normalized (rare)
      'duplicate_key',              -- DB unique constraint violation
      'dedup_query_failed',         -- findDedupMatches errored
      'db_insert_failed',           -- generic insert failure
      'transient',                  -- timeout / network blip
      'reconstructed_unknown',      -- recovered via CSV re-parse; no original reason
      'unknown'
    )),
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_contact_id  uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  resolved_at          timestamptz,
  resolved_by          uuid REFERENCES auth.users(id),
  resolution_note      text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csv_import_errors_import_status
  ON public.csv_import_errors (import_id, status);
CREATE INDEX IF NOT EXISTS idx_csv_import_errors_status
  ON public.csv_import_errors (status);
CREATE INDEX IF NOT EXISTS idx_csv_import_errors_code
  ON public.csv_import_errors (error_code);

ALTER TABLE public.csv_import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY csv_import_errors_select
  ON public.csv_import_errors FOR SELECT
  USING (public.has_permission(auth.uid(), 'contacts.read'));

CREATE POLICY csv_import_errors_all
  ON public.csv_import_errors FOR ALL
  USING (public.has_permission(auth.uid(), 'contacts.write'))
  WITH CHECK (public.has_permission(auth.uid(), 'contacts.write'));

COMMENT ON TABLE public.csv_import_errors IS
  'Per-row failures from CSV contact imports. One row per failed CSV row. Lifecycle: pending → resolved (via fix-and-retry that successfully created/matched a contact) or dismissed (admin marked as not worth recovering). FK cascades on csv_imports delete so undo cleans these up too.';
COMMENT ON COLUMN public.csv_import_errors.row_index IS
  'Zero-based index of the row within the entire import (not within a single batch). Useful for finding the row in the original CSV.';
COMMENT ON COLUMN public.csv_import_errors.raw_row IS
  'The post-trim CSV row payload that was passed to upsertContactWithDedup. Used as the seed when Fix-and-Retry opens the editor.';
COMMENT ON COLUMN public.csv_import_errors.error_code IS
  'Classified failure type. reconstructed_unknown = recovered via post-hoc CSV re-parse, no original error message known.';
