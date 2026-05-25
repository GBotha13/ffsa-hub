-- ============================================================
-- FFSA Hub — Migration 065: Brand kits per sending identity
-- ============================================================
-- Each sending_identity (From: address) gets its own brand kit:
-- logo, colors, fonts, footer copy, social links. The renderer
-- merges brand kit values with editorial defaults so a kit can be
-- partially filled in and still produce a polished email.
--
-- Also adds two public storage buckets:
--   - brand-assets    : logos, header art, etc.
--   - campaign-images : in-email imagery uploaded from the composer.
--
-- Uploads go through admin-client API routes (service role), so
-- no INSERT policy is required on storage.objects.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. sending_identity_brands  (1:1 with sending_identities)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.sending_identity_brands (
  sending_identity_id uuid PRIMARY KEY
    REFERENCES public.sending_identities(id) ON DELETE CASCADE,

  -- Visual identity
  logo_url            text,
  primary_color       text,           -- main brand color (header band, links)
  accent_color        text,           -- CTA buttons, highlights
  text_color          text,           -- body text
  bg_color            text,           -- email background
  display_font        text,           -- headlines (e.g. "Fraunces")
  body_font           text,           -- body copy (e.g. "Inter")

  -- Footer / signature
  org_name            text,
  org_address         text,           -- physical address (CAN-SPAM-ish best practice)
  footer_tagline      text,
  social_links        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{platform,url}]

  updated_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sending_identity_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read brand kits"
  ON public.sending_identity_brands FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage brand kits"
  ON public.sending_identity_brands FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.sending_identity_brands IS
  'Per-identity brand kit (logo, colors, fonts, footer). One row per sending identity, optional fields fall back to editorial defaults in the renderer.';

COMMENT ON COLUMN public.sending_identity_brands.social_links IS
  'JSON array of {platform, url}. Platform values: instagram, facebook, youtube, x, tiktok, web.';

-- ────────────────────────────────────────────────────────────
-- 2. Storage buckets
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  3145728,  -- 3 MB (logos can be larger than event logos)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  true,
  10485760,  -- 10 MB (hero imagery)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.sending_identity_brands;   -- 0
--   SELECT id, public FROM storage.buckets WHERE id IN ('brand-assets','campaign-images');
--   -- two rows, both public = true
-- ============================================================
