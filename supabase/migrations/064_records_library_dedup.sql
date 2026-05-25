-- ============================================================
-- FFSA Hub — Migration 064: Records Library importer dedup
-- ============================================================
-- Adds content_hash to every library_* child table so the
-- importer can skip rows that are byte-for-byte identical to an
-- existing record for the same person — the common
-- "re-imported the same CSV by accident" case that was creating
-- N copies of every application.
--
-- The hash is computed client-side (sha-256 over the sorted JSON
-- of the row's core columns + raw_data) and stored as text.
-- Non-unique index on (person_id, content_hash) for fast
-- existence checks; a hard unique constraint can't be added
-- here because existing rows already contain duplicates that
-- would need to be cleaned up first.
--
-- Also adds skipped_count to library_imports so the import
-- summary can report how many rows were skipped vs created.
-- ============================================================

ALTER TABLE public.library_applications ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.library_payments     ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.library_enrollments  ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.library_documents    ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_library_applications_dedup
  ON public.library_applications (person_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_library_payments_dedup
  ON public.library_payments (person_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_library_enrollments_dedup
  ON public.library_enrollments (person_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_library_documents_dedup
  ON public.library_documents (person_id, content_hash)
  WHERE content_hash IS NOT NULL;

ALTER TABLE public.library_imports
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.library_applications.content_hash IS
  'sha-256 hex of the normalized row content. Used by the importer to skip duplicate rows on re-import.';
COMMENT ON COLUMN public.library_payments.content_hash IS
  'sha-256 hex of the normalized row content. Used by the importer to skip duplicate rows on re-import.';
COMMENT ON COLUMN public.library_enrollments.content_hash IS
  'sha-256 hex of the normalized row content. Used by the importer to skip duplicate rows on re-import.';
COMMENT ON COLUMN public.library_documents.content_hash IS
  'sha-256 hex of the normalized row content. Used by the importer to skip duplicate rows on re-import.';
