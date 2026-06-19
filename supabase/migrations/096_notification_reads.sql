-- ============================================================
-- FFSA Hub — Migration 096: Dashboard notification read-state
-- ============================================================
-- The dashboard notification feed is DERIVED on each load from the
-- actionable items across modules (pending booking requests, staff awaiting
-- approval, records to match, …). This table just records which of those
-- derived notifications each user has marked read, keyed by a stable string
-- (e.g. 'booking:<uuid>'). No notification content is stored here.
-- ============================================================

CREATE TABLE public.notification_reads (
  user_id          uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  notification_key text NOT NULL,
  read_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_key)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- A user only ever sees and manages their own read markers.
CREATE POLICY "notification_reads_own_select" ON public.notification_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notification_reads_own_write" ON public.notification_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
