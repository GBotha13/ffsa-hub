-- Index the contacts.last_name / first_name columns so the new "Name (A-Z)"
-- and "Name (Z-A)" sort options on the Contacts page can use an index scan
-- instead of a sequential scan + filesort. CONCURRENTLY so we don't lock the
-- table on a production rollout.
--
-- We don't bother with a partial WHERE clause: most contacts have a last_name,
-- and Postgres can sort NULLs through a B-tree fine.

CREATE INDEX IF NOT EXISTS idx_contacts_last_name
  ON public.contacts (last_name);

CREATE INDEX IF NOT EXISTS idx_contacts_first_name
  ON public.contacts (first_name);
