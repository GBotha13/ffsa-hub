-- ============================================================
-- FFSA Hub — Migration 059: Order line items as JSONB
-- ============================================================
-- Persists the per-tier quantities of an order so fulfilment
-- (ticket 10) knows what tickets to issue once payment confirms.
-- We store this as JSONB rather than a separate table to keep
-- the v1 footprint small; a future order_lines table is a clean
-- additive migration if we need joins / per-line reporting.
--
-- Shape:
--   [
--     {
--       "ticket_type_id": "uuid",
--       "qty": 2,
--       "per_ticket_cents": 26500   // display_price_cents for fixed,
--                                   // the buyer-entered amount for pwyw
--     },
--     ...
--   ]
--
-- Append-only. Apply by hand in the Supabase SQL Editor, then
-- regenerate src/types/database.ts.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lines jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.lines IS
  'Per-tier quantities at checkout. Shape: [{ticket_type_id: uuid, qty: int, per_ticket_cents: int}]. Fulfilment reads this to know what tickets to issue.';


-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'orders' AND column_name = 'lines';
--   -- 1 row, data_type = jsonb
-- ============================================================
