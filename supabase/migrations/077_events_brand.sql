-- ============================================================
-- FFSA Hub — Migration 077: events.brand
-- ============================================================
-- Adds an explicit brand flag on events so every outbound email
-- tied to an event (workflow email steps, ticket confirmations,
-- scheduling, future event comms) can pick the right visual
-- shell without slug/title sniffing.
--
-- Two brands today:
--   - 'ff'       → Fire & Fragrance (warm-paper, gold accent, the
--                   existing workflow + transactional shell)
--   - 'the_send' → THE SEND (navy + cream + gold + red + blue,
--                   Arial Black display, ticker, the bespoke
--                   storefront aesthetic)
--
-- Backfill: any event whose public_slug or title already reads as
-- "the send" (matching the existing isTheSend detection in
-- src/lib/ticketing/fulfillment.ts and the storefront route) is
-- migrated to brand='the_send'. Everything else defaults to 'ff'.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN brand text NOT NULL DEFAULT 'ff'
    CHECK (brand IN ('ff', 'the_send'));

-- Backfill — matches the slug/title heuristic that fulfillment.ts
-- and the public storefront have been using.
UPDATE public.events
   SET brand = 'the_send'
 WHERE lower(coalesce(public_slug, '')) LIKE '%the-send%'
    OR lower(title) LIKE '%the send%';

COMMENT ON COLUMN public.events.brand IS
  'Visual brand for every email tied to this event. ''ff'' = Fire & Fragrance shell; ''the_send'' = THE SEND bespoke shell.';
