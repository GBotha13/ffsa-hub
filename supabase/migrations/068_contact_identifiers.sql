-- 068_contact_identifiers.sql
-- Promote contacts.email and contacts.phone from scalar fields to
-- one-of-many records, so the same person can hold multiple emails
-- (personal + work + old) and multiple phones.
--
-- Strategy:
--   • New tables contact_emails / contact_phones, each with an
--     is_primary flag (max one per contact via partial unique index).
--   • contacts.email / contacts.phone stay as a denormalised cache of
--     the primary row — kept in sync by AFTER triggers. Existing code
--     that reads contacts.email / contacts.phone keeps working.
--   • Dedup queries (in the app layer) now look across the join
--     tables, not just the cache.
--   • Backfill: every existing contact's current email + phone are
--     inserted as their primary rows.

-- ────────────────────────────────────────────────────────────
-- contact_emails
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  email             text NOT NULL CHECK (length(btrim(email)) > 0),
  email_normalized  text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  label             text NOT NULL DEFAULT 'primary',
  is_primary        boolean NOT NULL DEFAULT false,
  source            text,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Prevent the same email from being added twice to the same contact.
CREATE UNIQUE INDEX IF NOT EXISTS contact_emails_unique_per_contact
  ON public.contact_emails (contact_id, email_normalized);

-- Exactly-at-most-one primary per contact.
CREATE UNIQUE INDEX IF NOT EXISTS contact_emails_one_primary_per_contact
  ON public.contact_emails (contact_id)
  WHERE is_primary = true;

-- Fast lookup for dedup queries.
CREATE INDEX IF NOT EXISTS contact_emails_normalized_idx
  ON public.contact_emails (email_normalized);

CREATE INDEX IF NOT EXISTS contact_emails_contact_idx
  ON public.contact_emails (contact_id);

-- ────────────────────────────────────────────────────────────
-- contact_phones
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_phones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone             text NOT NULL CHECK (length(btrim(phone)) > 0),
  -- phone_normalized is managed by the application (libphonenumber-js)
  -- rather than a generated column. CHECK enforces E.164 shape when
  -- provided.
  phone_normalized  text
    CHECK (phone_normalized IS NULL OR phone_normalized ~ '^\+[1-9][0-9]{6,14}$'),
  label             text NOT NULL DEFAULT 'primary',
  is_primary        boolean NOT NULL DEFAULT false,
  source            text,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_phones_unique_per_contact
  ON public.contact_phones (contact_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contact_phones_one_primary_per_contact
  ON public.contact_phones (contact_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS contact_phones_normalized_idx
  ON public.contact_phones (phone_normalized);

CREATE INDEX IF NOT EXISTS contact_phones_contact_idx
  ON public.contact_phones (contact_id);

-- ────────────────────────────────────────────────────────────
-- Primary-row cache triggers
-- Keep contacts.email / contacts.phone in sync with whichever child
-- row currently has is_primary = true. NULL when no primary exists.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_contact_email_cache(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM public.contact_emails
  WHERE contact_id = p_contact_id AND is_primary = true
  LIMIT 1;
  UPDATE public.contacts
  SET email = v_email
  WHERE id = p_contact_id
    AND (email IS DISTINCT FROM v_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_contact_phone_cache(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_phone text;
  v_phone_normalized text;
BEGIN
  SELECT phone, phone_normalized INTO v_phone, v_phone_normalized
  FROM public.contact_phones
  WHERE contact_id = p_contact_id AND is_primary = true
  LIMIT 1;
  UPDATE public.contacts
  SET phone = v_phone,
      phone_normalized = v_phone_normalized
  WHERE id = p_contact_id
    AND (phone IS DISTINCT FROM v_phone OR phone_normalized IS DISTINCT FROM v_phone_normalized);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_contact_emails_sync_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.refresh_contact_email_cache(OLD.contact_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_contact_email_cache(NEW.contact_id);
    IF (TG_OP = 'UPDATE' AND OLD.contact_id <> NEW.contact_id) THEN
      PERFORM public.refresh_contact_email_cache(OLD.contact_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_contact_phones_sync_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.refresh_contact_phone_cache(OLD.contact_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_contact_phone_cache(NEW.contact_id);
    IF (TG_OP = 'UPDATE' AND OLD.contact_id <> NEW.contact_id) THEN
      PERFORM public.refresh_contact_phone_cache(OLD.contact_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS contact_emails_sync_cache ON public.contact_emails;
CREATE TRIGGER contact_emails_sync_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_emails
  FOR EACH ROW EXECUTE FUNCTION public.tg_contact_emails_sync_cache();

DROP TRIGGER IF EXISTS contact_phones_sync_cache ON public.contact_phones;
CREATE TRIGGER contact_phones_sync_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_phones
  FOR EACH ROW EXECUTE FUNCTION public.tg_contact_phones_sync_cache();

-- ────────────────────────────────────────────────────────────
-- Auto-promote next email/phone to primary when current primary is
-- deleted, so contacts.email never goes blank just because the user
-- removed the row marked primary. Picks oldest remaining row.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_contact_emails_auto_promote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_id uuid;
BEGIN
  IF OLD.is_primary THEN
    SELECT id INTO v_next_id
    FROM public.contact_emails
    WHERE contact_id = OLD.contact_id
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE public.contact_emails SET is_primary = true WHERE id = v_next_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_contact_phones_auto_promote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_id uuid;
BEGIN
  IF OLD.is_primary THEN
    SELECT id INTO v_next_id
    FROM public.contact_phones
    WHERE contact_id = OLD.contact_id
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE public.contact_phones SET is_primary = true WHERE id = v_next_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS contact_emails_auto_promote ON public.contact_emails;
CREATE TRIGGER contact_emails_auto_promote
  AFTER DELETE ON public.contact_emails
  FOR EACH ROW EXECUTE FUNCTION public.tg_contact_emails_auto_promote();

DROP TRIGGER IF EXISTS contact_phones_auto_promote ON public.contact_phones;
CREATE TRIGGER contact_phones_auto_promote
  AFTER DELETE ON public.contact_phones
  FOR EACH ROW EXECUTE FUNCTION public.tg_contact_phones_auto_promote();

-- ────────────────────────────────────────────────────────────
-- Backfill: every existing contact's current email and phone become
-- their primary identifier rows. The cache trigger will fire as we
-- insert, but it's a no-op since contacts.email already equals what
-- we're inserting.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.contact_emails (
  contact_id, email, label, is_primary, source, created_at, updated_at
)
SELECT
  c.id,
  c.email,
  'primary',
  true,
  c.source,
  c.created_at,
  c.updated_at
FROM public.contacts c
WHERE c.email IS NOT NULL
  AND length(btrim(c.email)) > 0
ON CONFLICT (contact_id, email_normalized) DO NOTHING;

INSERT INTO public.contact_phones (
  contact_id, phone, phone_normalized, label, is_primary, source, created_at, updated_at
)
SELECT
  c.id,
  c.phone,
  c.phone_normalized,
  'primary',
  true,
  c.source,
  c.created_at,
  c.updated_at
FROM public.contacts c
WHERE c.phone IS NOT NULL
  AND length(btrim(c.phone)) > 0
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- RLS — same gates as contacts (contacts.read / contacts.write).
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_emails_select
  ON public.contact_emails FOR SELECT
  USING (public.has_permission('contacts.read'));
CREATE POLICY contact_emails_all
  ON public.contact_emails FOR ALL
  USING (public.has_permission('contacts.write'))
  WITH CHECK (public.has_permission('contacts.write'));

CREATE POLICY contact_phones_select
  ON public.contact_phones FOR SELECT
  USING (public.has_permission('contacts.read'));
CREATE POLICY contact_phones_all
  ON public.contact_phones FOR ALL
  USING (public.has_permission('contacts.write'))
  WITH CHECK (public.has_permission('contacts.write'));

COMMENT ON TABLE public.contact_emails IS
  'One row per email a contact can be reached at. contacts.email is the denormalised primary cache.';
COMMENT ON TABLE public.contact_phones IS
  'One row per phone a contact can be reached at. contacts.phone is the denormalised primary cache.';
