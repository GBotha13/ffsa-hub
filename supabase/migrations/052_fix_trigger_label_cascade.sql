-- ============================================================
-- FFSA Hub — Migration 052: trigger also skips on label cascade
-- ============================================================
-- Migration 051 fixed the contact-cascade case for the
-- contact_label_removal_records_unsubscribe() trigger but missed
-- the symmetric case: deleting a *label* also cascades through
-- contact_labels, fires this trigger, and tries to INSERT into
-- unsubscribes(label_id) — which fails because the label has
-- already been (or is being) deleted.
--
-- Net effect of the bug: labels couldn't be deleted at all if
-- any contact still held them.
--
-- Fix: short-circuit if EITHER the contact OR the label no longer
-- exists. The intended path (admin removes a label from a contact
-- while both still exist) is unaffected.
--
-- Caught in detailed E2E test on 2026-05-19 while cleaning up
-- test data. Trigger already updated in the live DB via SQL
-- Editor; this migration captures the fix.
-- ============================================================

CREATE OR REPLACE FUNCTION public.contact_label_removal_records_unsubscribe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  -- Skip if the cascade was triggered by deletion of the parent
  -- contact OR the parent label (in either case the unsubscribes
  -- row would orphan against an FK that's about to disappear).
  IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = OLD.contact_id) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.labels WHERE id = OLD.label_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.unsubscribes (contact_id, label_id, source, reason)
  VALUES (OLD.contact_id, OLD.label_id, 'staff_manual', 'label removed')
  ON CONFLICT DO NOTHING;

  RETURN OLD;
END;
$func$;
