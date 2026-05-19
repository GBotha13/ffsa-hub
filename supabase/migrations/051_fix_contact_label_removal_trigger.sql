-- ============================================================
-- FFSA Hub — Migration 051: Fix 046 contact-label-removal trigger
-- ============================================================
-- The trigger created in migration 046 inserts an unsubscribes
-- row whenever a contact_labels row is deleted, to keep the
-- per-label opt-out record in sync with label removals.
--
-- Problem: contact_labels rows are also deleted via FK CASCADE
-- when the parent contact is deleted. In that case the trigger
-- fires AFTER the contact row no longer exists, and the INSERT
-- into unsubscribes (which has a FK to contacts) fails with
-- "violates foreign key constraint unsubscribes_contact_id_fkey".
--
-- Net effect of the bug: contacts couldn't be deleted at all if
-- they had any labels (which is essentially every contact post-
-- import).
--
-- Fix: short-circuit if the parent contact no longer exists.
-- The manual unsubscribe-on-label-remove path (admin UI / form
-- handler) still works because in those paths the contact is
-- present and only the contact_labels row is being removed.
--
-- Caught by E2E test on 2026-05-19. Trigger already updated in
-- the live DB via SQL Editor — this migration captures the fix
-- in version control for any environment that hasn't applied
-- it yet.
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

  -- Skip silently if the parent contact has already been
  -- deleted (the cascade fired this trigger). The unsubscribes
  -- row would have nowhere to point.
  IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = OLD.contact_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.unsubscribes (contact_id, label_id, source, reason)
  VALUES (OLD.contact_id, OLD.label_id, 'staff_manual', 'label removed')
  ON CONFLICT DO NOTHING;

  RETURN OLD;
END;
$func$;

-- The trigger itself is unchanged; it still fires AFTER DELETE
-- on contact_labels. Only the function body is replaced.

-- ============================================================
-- Validation
-- ------------------------------------------------------------
-- After applying, you can confirm a contact with labels can be
-- deleted without error:
--
--   BEGIN;
--   INSERT INTO public.contacts (email) VALUES ('trigger-test@example.test')
--     RETURNING id \gset
--   INSERT INTO public.labels (slug, name) VALUES ('_trigger_test', 'trigger test')
--     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
--     RETURNING id \gset
--   INSERT INTO public.contact_labels (contact_id, label_id, added_via)
--     VALUES (:'id', :'id', 'manual:test');
--   DELETE FROM public.contacts WHERE id = :'id';
--   ROLLBACK;
-- ============================================================
