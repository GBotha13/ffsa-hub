-- ============================================================
-- FFSA Hub — Migration 080: Seed THE SEND sending identity
-- ============================================================
-- Ticket confirmation emails (src/lib/ticketing/fulfillment.ts)
-- previously hardcoded From: "Fire & Fragrance SA". With the
-- brand flag landed in migration 077, we now resolve the sender
-- per-event by brand:
--
--   brand='ff'       → sending_identities.slug = 'events'
--   brand='the_send' → sending_identities.slug = 'the-send'
--
-- The 'events' identity already exists (migration 066). This
-- migration adds the missing 'the-send' identity so THE SEND
-- ticket emails land with their own From: name and a reply-to
-- that routes to the shared inbox.
--
-- Admins can edit either identity's display_name / from_name /
-- reply_to from /communications/identities without a deploy.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING — safe to re-run.
-- ============================================================

INSERT INTO public.sending_identities (slug, display_name, from_email, from_name, reply_to, provider, is_active)
VALUES
  ('the-send', 'THE SEND', 'the-send@ffsahub.com', 'THE SEND', 'hello@ffsahub.com', 'mailtrap', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT slug, from_name, from_email, reply_to
--   FROM public.sending_identities
--   WHERE slug IN ('events', 'the-send');
--   -- expect 2 rows
-- ============================================================
