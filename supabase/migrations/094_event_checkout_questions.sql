-- ============================================================
-- FFSA Hub — Migration 094: custom checkout questions
-- ============================================================
-- Lets an event define a list of custom questions collected from the
-- buyer at ticket checkout (e.g. church/group, how they heard,
-- emergency contact, dietary needs). Configured per event in the admin
-- Tickets tab; answered once per order by the buyer.
--
-- Two columns:
--   - events.checkout_questions : the question schema. A flat JSON array
--     of fields shaped like src/lib/forms/schema.ts FormField
--     (id, type, label, required, options?, helpText?, parentFieldId?,
--     showWhenValue?). Empty array = no custom questions (default).
--   - orders.custom_answers     : the buyer's answers, stored as a
--     self-describing snapshot array [{ id, label, value }] so the admin
--     order view stays correct even if the questions are edited later.
--
-- Numbered 094 (not 092) so it can't collide with the in-flight FFSA
-- Camps branch, which already claims migrations 092 + 093.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Safe to re-run.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS checkout_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.checkout_questions IS
  'Custom checkout questions for this event. Flat JSON array of FormField-shaped objects (see src/lib/forms/schema.ts). Empty = none.';
COMMENT ON COLUMN public.orders.custom_answers IS
  'Buyer answers to the event''s checkout_questions, captured at purchase. Snapshot array of { id, label, value } so it stays readable if questions change.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE (table_name = 'events'  AND column_name = 'checkout_questions')
--      OR (table_name = 'orders'  AND column_name = 'custom_answers');
--   -- expect 2 rows, both jsonb defaulting to '[]'
-- ============================================================
