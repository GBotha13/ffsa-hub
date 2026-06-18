-- ============================================================
-- FFSA Hub — Migration 092: events.brand += 'ffsa_camps'
-- ============================================================
-- Adds FFSA Camps as a third event-level brand alongside Fire &
-- Fragrance ('ff') and THE SEND ('the_send'). The brand drives the
-- visual identity of every surface tied to an event: the public
-- storefront + registration forms, workflow-step emails, and ticket
-- confirmations.
--
-- Three brands now:
--   - 'ff'         → Fire & Fragrance (black/gold, Roboto)
--   - 'the_send'   → THE SEND (navy/cream/gold, Arial Black, ticker)
--   - 'ffsa_camps' → FFSA Camps (bright blue #2F65E8 + cream #F2E8CC,
--                     heavy italic display, "PERMISSION GRANTED" slogan)
--
-- Migration 077 created the column with an inline CHECK, which Postgres
-- auto-named `events_brand_check`. We drop it and re-add it widened.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS first, so this is safe to re-run.
-- No backfill — existing rows keep their current brand.
-- ============================================================

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_brand_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_brand_check
    CHECK (brand IN ('ff', 'the_send', 'ffsa_camps'));

COMMENT ON COLUMN public.events.brand IS
  'Visual brand for every email + public surface tied to this event. ''ff'' = Fire & Fragrance; ''the_send'' = THE SEND bespoke shell; ''ffsa_camps'' = FFSA Camps bespoke shell.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   -- The constraint should now accept the new value:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.events'::regclass AND conname = 'events_brand_check';
--   -- expect: CHECK (brand IN ('ff', 'the_send', 'ffsa_camps'))
-- ============================================================
