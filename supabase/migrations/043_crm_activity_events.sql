-- ============================================================
-- FFSA Hub — Migration 043: Activity events (timeline)
-- ============================================================
-- The unified timeline of everything that has happened with a
-- contact. Powers the contact profile timeline UI and feeds
-- analytics (open rates, label-add velocity, etc.).
--
-- related_form_id and related_campaign_id are typed as uuid
-- WITHOUT a FK constraint at this stage — the forms and
-- campaigns tables don't exist yet (migrations 044 and 045).
-- Those migrations add the FK constraints.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.4
-- ============================================================

CREATE TABLE public.activity_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id           uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_type           text NOT NULL CHECK (event_type IN (
    'contact_created', 'contact_updated', 'contact_merged',
    'label_added', 'label_removed',
    'form_submitted',
    'csv_imported',
    'event_attended',
    'email_sent', 'email_delivered', 'email_opened',
    'email_clicked', 'email_bounced', 'email_complained', 'email_unsubscribed',
    'note_added',
    'manual_interaction'
  )),
  payload              jsonb,
  related_label_id     uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  related_form_id      uuid,   -- FK added in 044
  related_campaign_id  uuid,   -- FK added in 045
  related_user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_events_contact     ON public.activity_events (contact_id, occurred_at DESC);
CREATE INDEX idx_activity_events_type        ON public.activity_events (event_type);
CREATE INDEX idx_activity_events_label       ON public.activity_events (related_label_id)    WHERE related_label_id    IS NOT NULL;
CREATE INDEX idx_activity_events_form        ON public.activity_events (related_form_id)     WHERE related_form_id     IS NOT NULL;
CREATE INDEX idx_activity_events_campaign    ON public.activity_events (related_campaign_id) WHERE related_campaign_id IS NOT NULL;

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read activity events"
  ON public.activity_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can insert activity events"
  ON public.activity_events FOR INSERT
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin') OR public.has_role('events_admin'));

-- No UPDATE / DELETE policies: activity is append-only by design.

COMMENT ON TABLE public.activity_events IS
  'Append-only timeline of contact interactions. Powers the contact profile timeline and analytics.';

-- ────────────────────────────────────────────────────────────
-- Trigger: keep contacts.last_interaction_at current
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_contact_last_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contacts
  SET last_interaction_at = NEW.occurred_at
  WHERE id = NEW.contact_id
    AND (last_interaction_at IS NULL OR NEW.occurred_at > last_interaction_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_events_update_contact_last_interaction
AFTER INSERT ON public.activity_events
FOR EACH ROW
EXECUTE FUNCTION public.update_contact_last_interaction();

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname = 'activity_events';   -- relrowsecurity = true
--
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.activity_events'::regclass
--     AND NOT tgisinternal;
--   -- should list trg_activity_events_update_contact_last_interaction
-- ============================================================
