-- 066_csv_imports_rolled_back.sql
-- Adds 'rolled_back' to csv_imports.status so the undo-import action can
-- mark an import as undone (rather than deleting the audit row).

ALTER TABLE public.csv_imports
  DROP CONSTRAINT IF EXISTS csv_imports_status_check;

ALTER TABLE public.csv_imports
  ADD CONSTRAINT csv_imports_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rolled_back'));

COMMENT ON COLUMN public.csv_imports.status IS
  'pending → processing → completed | failed. rolled_back = an admin undid this import via the UI; net-new contacts were deleted and the import''s label was removed from matched contacts.';
