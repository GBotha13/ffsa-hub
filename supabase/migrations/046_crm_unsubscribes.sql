-- ============================================================
-- FFSA Hub — Migration 046: Unsubscribes + suppressions
-- ============================================================
-- The opt-out side of the labels model. Per the spec:
--   - inserting unsubscribes(contact_id, label_id) deletes the
--     matching contact_labels row
--   - deleting a contact_labels row inserts an unsubscribes row
--     (source = 'staff_manual') unless one already exists
--   - global unsubscribe (label_id IS NULL) removes ALL labels
--     and sets contacts.marketing_status = 'unsubscribed_all'
--
-- Triggers use pg_trigger_depth() to avoid recursion when one
-- side fires the other.
--
-- email_suppressions is a separate, simpler global list — hard
-- bounces and complaints add rows; the send pipeline checks it
-- regardless of label or contact state.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.7, §8
-- ============================================================

CREATE TABLE public.unsubscribes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  label_id        uuid REFERENCES public.labels(id) ON DELETE CASCADE,
  reason          text,
  source          text NOT NULL CHECK (source IN (
    'email_footer', 'preferences_page', 'staff_manual', 'bounce_threshold', 'complaint'
  )),
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes: a contact can only have one row per
-- label (or one global row with NULL label). Using UNIQUE INDEX
-- instead of UNIQUE constraint because NULL behaves
-- differently in plain UNIQUE.
CREATE UNIQUE INDEX idx_unsubscribes_label_unique
  ON public.unsubscribes (contact_id, label_id)
  WHERE label_id IS NOT NULL;

CREATE UNIQUE INDEX idx_unsubscribes_global_unique
  ON public.unsubscribes (contact_id)
  WHERE label_id IS NULL;

CREATE INDEX idx_unsubscribes_contact ON public.unsubscribes (contact_id);
CREATE INDEX idx_unsubscribes_label   ON public.unsubscribes (label_id) WHERE label_id IS NOT NULL;

ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read unsubscribes"
  ON public.unsubscribes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage unsubscribes"
  ON public.unsubscribes FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.unsubscribes IS
  'Per-label opt-outs. label_id IS NULL = global (all labels). Kept in sync with contact_labels via triggers.';

-- ────────────────────────────────────────────────────────────
-- email_suppressions
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.email_suppressions (
  email_normalized text PRIMARY KEY,
  reason           text NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual')),
  added_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read suppressions"
  ON public.email_suppressions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage suppressions"
  ON public.email_suppressions FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.email_suppressions IS
  'Global send-time block list keyed on the contact''s email_normalized. Hard bounces and complaints land here automatically.';

-- ────────────────────────────────────────────────────────────
-- Bidirectional sync triggers
-- ────────────────────────────────────────────────────────────

-- When an unsubscribe is recorded, remove the matching label(s).
CREATE OR REPLACE FUNCTION public.unsubscribe_remove_labels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.label_id IS NULL THEN
    -- Global unsubscribe: remove all labels and flip marketing_status
    DELETE FROM public.contact_labels WHERE contact_id = NEW.contact_id;
    UPDATE public.contacts
      SET marketing_status = 'unsubscribed_all'
      WHERE id = NEW.contact_id;
  ELSE
    DELETE FROM public.contact_labels
      WHERE contact_id = NEW.contact_id AND label_id = NEW.label_id;
  END IF;

  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_unsubscribes_remove_labels
AFTER INSERT ON public.unsubscribes
FOR EACH ROW
EXECUTE FUNCTION public.unsubscribe_remove_labels();

-- When a label is removed from a contact, record an unsubscribe
-- (unless one already exists). This captures admin-initiated
-- removals and form/preferences-page flows uniformly.
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

  INSERT INTO public.unsubscribes (contact_id, label_id, source, reason)
  VALUES (OLD.contact_id, OLD.label_id, 'staff_manual', 'label removed')
  ON CONFLICT DO NOTHING;

  RETURN OLD;
END;
$func$;

CREATE TRIGGER trg_contact_labels_removal_unsubscribe
AFTER DELETE ON public.contact_labels
FOR EACH ROW
EXECUTE FUNCTION public.contact_label_removal_records_unsubscribe();

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.unsubscribes;        -- 0
--   SELECT count(*) FROM public.email_suppressions;  -- 0
--
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid IN (
--     'public.unsubscribes'::regclass,
--     'public.contact_labels'::regclass
--   ) AND NOT tgisinternal;
--   -- expect: trg_unsubscribes_remove_labels,
--   --         trg_contact_labels_removal_unsubscribe
-- ============================================================
