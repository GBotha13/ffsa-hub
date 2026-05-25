-- ============================================================
-- FFSA Hub — Migration 064: library_imports.column_order
-- ============================================================
-- raw_data is jsonb which does NOT preserve key order — when we
-- render the form-response sheet on /records-library/persons/[id]
-- the fields come out alphabetically (or hash-ordered), which
-- scrambles them relative to the original CSV.
--
-- This column records the original CSV header order at import
-- time so the display can sort entries back into form order.
--
-- Nullable: pre-existing imports won't have it. The display
-- falls back to alphabetical for those.
-- ============================================================

ALTER TABLE public.library_imports
  ADD COLUMN IF NOT EXISTS column_order text[];

COMMENT ON COLUMN public.library_imports.column_order IS
  'Original CSV header order at import time. raw_data jsonb loses key order, so this lets the UI render fields in their original form sequence. NULL for imports done before this column existed.';
