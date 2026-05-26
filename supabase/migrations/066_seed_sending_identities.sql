-- ============================================================
-- FFSA Hub — Migration 066: Seed 8 sending identities
-- ============================================================
-- Adds the "expanded" set of From: addresses so Communications
-- composers can send each campaign from the voice that fits.
-- All live on @ffsahub.com which is already verified in Mailtrap,
-- so no DNS changes are needed.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING — safe to re-run.
-- ============================================================

INSERT INTO public.sending_identities (slug, display_name, from_email, from_name, reply_to, provider, is_active)
VALUES
  ('events',     'FFSA Events',     'events@ffsahub.com',     'FFSA Events',     'hello@ffsahub.com', 'mailtrap', true),
  ('giving',     'FFSA Giving',     'give@ffsahub.com',       'FFSA Giving',     'hello@ffsahub.com', 'mailtrap', true),
  ('newsletter', 'FFSA Newsletter', 'newsletter@ffsahub.com', 'FFSA Newsletter', 'hello@ffsahub.com', 'mailtrap', true),
  ('training',   'FFSA Training',   'training@ffsahub.com',   'FFSA Training',   'hello@ffsahub.com', 'mailtrap', true),
  ('prayer',     'FFSA Prayer',     'prayer@ffsahub.com',     'FFSA Prayer',     'hello@ffsahub.com', 'mailtrap', true),
  ('outreach',   'FFSA Outreach',   'outreach@ffsahub.com',   'FFSA Outreach',   'hello@ffsahub.com', 'mailtrap', true),
  ('leadership', 'FFSA Leadership', 'leadership@ffsahub.com', 'FFSA Leadership', 'hello@ffsahub.com', 'mailtrap', true),
  ('ffx',        'FFSA FFX',        'ffx@ffsahub.com',        'FFSA FFX',        'hello@ffsahub.com', 'mailtrap', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT slug, display_name, from_email FROM public.sending_identities
--   WHERE is_active = true
--   ORDER BY display_name;
--   -- expect 9 rows (default-marketing + the 8 above)
-- ============================================================
