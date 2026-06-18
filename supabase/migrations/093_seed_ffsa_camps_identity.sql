-- ============================================================
-- FFSA Hub — Migration 093: Seed FFSA Camps sending identity
-- ============================================================
-- With FFSA Camps landed as a third event brand (migration 092),
-- ticket confirmation emails (src/lib/ticketing/fulfillment.ts) and
-- workflow-step emails resolve the From: sender per-event by brand:
--
--   brand='ff'         → sending_identities.slug = 'events'
--   brand='the_send'   → sending_identities.slug = 'the-send'
--   brand='ffsa_camps' → sending_identities.slug = 'ffsa-camps'
--
-- The 'events' (migration 066) and 'the-send' (migration 080)
-- identities already exist. This adds the missing 'ffsa-camps'
-- identity so FFSA Camps emails land with their own From: name and a
-- reply-to that routes to the shared inbox. camps@ffsahub.com sits on
-- the already-verified ffsahub.com domain.
--
-- Admins can edit the display_name / from_name / reply_to from
-- /communications/identities without a deploy.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING — safe to re-run.
-- ============================================================

INSERT INTO public.sending_identities (slug, display_name, from_email, from_name, reply_to, provider, is_active)
VALUES
  ('ffsa-camps', 'FFSA Camps', 'camps@ffsahub.com', 'FFSA Camps', 'hello@ffsahub.com', 'mailtrap', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT slug, from_name, from_email, reply_to
--   FROM public.sending_identities
--   WHERE slug IN ('events', 'the-send', 'ffsa-camps');
--   -- expect 3 rows
-- ============================================================
