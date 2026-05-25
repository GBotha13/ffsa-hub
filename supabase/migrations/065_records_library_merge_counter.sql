-- ============================================================
-- FFSA Hub — Migration 065: merged_count on library_imports
-- ============================================================
-- The importer now supports re-imports that "fill the gaps" on
-- existing rows instead of creating duplicates. This column
-- lets the import summary report Created vs Merged vs Skipped
-- vs Errors so staff can see what an import actually did.
-- ============================================================

ALTER TABLE public.library_imports
  ADD COLUMN IF NOT EXISTS merged_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.library_imports.merged_count IS
  'Rows that matched an existing record by typed key (e.g. person + program + cohort for applications) and filled in previously-empty fields rather than creating a duplicate.';
