-- ============================================================
-- FFSA Hub — Migration 332: Fleet — daily reminder log
-- ============================================================
-- PROVISIONAL NUMBER (see 329): renumber with 329–331 if needed.
--
-- One row per day the 07:00 Fleet reminder went out (SPEC 6.11), so a retried
-- or doubled cron never sends it twice, and admins can see when it last went
-- and to whom. Written only by the cron route with the service role.
-- ============================================================

CREATE TABLE public.fleet_reminder_sends (
  date        date PRIMARY KEY,               -- the South African date it was for
  subject     text NOT NULL,
  recipients  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name, email: ok|error|off, slack: ok|error|off}]
  sent_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_reminder_sends ENABLE ROW LEVEL SECURITY;

-- Read: Fleet managers and admins (the preview page shows the last sends).
-- No insert/update/delete policy: only the service role writes.
CREATE POLICY fleet_reminder_sends_read ON public.fleet_reminder_sends
  FOR SELECT TO authenticated
  USING (public.manages_fleet());

-- ────────────────────────────────────────────────────────────
-- Validation
-- ────────────────────────────────────────────────────────────
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'fleet_reminder_sends';
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'fleet_reminder_sends';
