-- ============================================================
-- FFSA Hub — Migration 060: Ticket activity_event types
-- ============================================================
-- Extends the activity_events.event_type CHECK constraint to
-- include the three ticketing events written by fulfilment and
-- the door check-in scanner (ticket 13):
--
--   ticket_purchased    — written by CRM resolution after a paid
--                          order is linked to a contact.
--   ticket_refunded     — written when staff refunds an order.
--   ticket_checked_in   — written when a ticket is scanned at the
--                          door (logged against the buyer's contact).
--
-- Replaces the existing auto-named CHECK constraint with the
-- extended list. Append-only — no schema reshape.
-- ============================================================

ALTER TABLE public.activity_events
  DROP CONSTRAINT IF EXISTS activity_events_event_type_check;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_event_type_check
  CHECK (event_type IN (
    'contact_created', 'contact_updated', 'contact_merged',
    'label_added', 'label_removed',
    'form_submitted',
    'csv_imported',
    'event_attended',
    'email_sent', 'email_delivered', 'email_opened',
    'email_clicked', 'email_bounced', 'email_complained', 'email_unsubscribed',
    'note_added',
    'manual_interaction',
    'ticket_purchased', 'ticket_refunded', 'ticket_checked_in'
  ));


-- ============================================================
-- Validation
-- ------------------------------------------------------------
-- After applying:
--   INSERT INTO public.activity_events (contact_id, event_type)
--   SELECT id, 'ticket_purchased' FROM public.contacts LIMIT 1;
--   -- (should succeed; rollback after testing)
-- ============================================================
