-- ============================================================
-- FFSA Hub — Migration 042: Labels + sending identities
-- ============================================================
-- Adds the core CRM primitives:
--   1. sending_identities — From: addresses campaigns send through
--   2. labels             — preset library + custom, drives email lists
--   3. contact_labels     — join table linking contacts to labels
--                           with provenance (form / csv / manual)
--
-- A contact's set of labels simultaneously represents (a) their
-- ministry interests and (b) the email lists they belong to.
-- v1 ships with "one label per send" semantics (§5 of the spec).
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.2, §3.3
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. sending_identities
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.sending_identities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  from_email    text NOT NULL,
  from_name     text NOT NULL,
  reply_to      text,
  provider      text NOT NULL CHECK (provider IN ('mailtrap', 'resend')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sending_identities_active ON public.sending_identities (is_active) WHERE is_active = true;

ALTER TABLE public.sending_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read sending identities"
  ON public.sending_identities FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage sending identities"
  ON public.sending_identities FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.sending_identities IS
  'Configured "From" identities for outbound email. Each label points at one; campaigns inherit the label''s identity.';

-- Seed one default identity so labels created in this migration
-- (or via UI) have a non-null option to reference. Update via UI
-- once real Mailtrap addresses are configured.
INSERT INTO public.sending_identities (slug, display_name, from_email, from_name, provider)
VALUES ('default-marketing', 'FFSA Hub — Default', 'noreply@ffsahub.com', 'FFSA Hub', 'mailtrap')
ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. labels
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.labels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text UNIQUE NOT NULL,
  name                text NOT NULL,
  description         text,
  category            text,
  color               text,
  is_preset           boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  sending_identity_id uuid REFERENCES public.sending_identities(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_labels_slug ON public.labels (slug);
CREATE INDEX idx_labels_category ON public.labels (category) WHERE category IS NOT NULL;
CREATE INDEX idx_labels_active ON public.labels (is_active) WHERE is_active = true;

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read labels"
  ON public.labels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage labels"
  ON public.labels FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.labels IS
  'Tag / interest / list primitive. A contact with label X is on the email list for label X. Preset labels (is_preset = true) are managed centrally; custom labels can be created on the fly by forms or CSV imports.';

COMMENT ON COLUMN public.labels.category IS
  'Optional grouping for the labels UI (e.g. "The Send", "Schools", "Donors"). Does not affect send logic; purely organizational.';

COMMENT ON COLUMN public.labels.sending_identity_id IS
  'Which From: address campaigns to this label send from. Nullable until configured.';

-- ────────────────────────────────────────────────────────────
-- 3. contact_labels
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.contact_labels (
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  label_id     uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  added_at     timestamptz NOT NULL DEFAULT now(),
  added_via    text NOT NULL,
  added_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (contact_id, label_id)
);

CREATE INDEX idx_contact_labels_label   ON public.contact_labels (label_id);
CREATE INDEX idx_contact_labels_contact ON public.contact_labels (contact_id);

ALTER TABLE public.contact_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read contact labels"
  ON public.contact_labels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage contact labels"
  ON public.contact_labels FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin') OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin') OR public.has_role('events_admin'));

COMMENT ON TABLE public.contact_labels IS
  'Join table: which labels each contact has. Removing a row = unsubscribing from that label''s email stream (kept in sync with unsubscribes via trigger in migration 046).';

COMMENT ON COLUMN public.contact_labels.added_via IS
  'Provenance: "form:<form_id>" | "csv:<import_id>" | "manual:<user_id>" | "import:<source>". Free-text, audit-only.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.sending_identities;          -- expect 1
--   SELECT count(*) FROM public.labels;                      -- expect 0
--   SELECT count(*) FROM public.contact_labels;              -- expect 0
--
--   -- Confirm RLS enabled on all three:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('sending_identities', 'labels', 'contact_labels');
--   -- All three should show relrowsecurity = true
-- ============================================================
