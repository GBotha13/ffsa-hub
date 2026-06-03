-- ────────────────────────────────────────────────────────────
-- 078 — audit_logs.user_id ON DELETE SET NULL
-- ────────────────────────────────────────────────────────────
-- The original audit_logs FK had no ON DELETE clause, so Postgres
-- defaulted to RESTRICT. That meant deleting any user who had ever
-- taken a logged action failed with a foreign-key constraint error,
-- forcing super admins to either keep stale accounts forever or
-- manually purge audit rows.
--
-- Switch to SET NULL so audit history is preserved (the action +
-- resource + changes payload stay intact) while the user link
-- becomes null on deletion. The audit row still describes WHAT
-- happened; it just no longer names the actor once that actor is
-- gone.

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users (id)
  ON DELETE SET NULL;
