-- ============================================================
-- FFSA Hub — Migration 072: Make a form shareable across outcomes
-- ============================================================
-- Relaxes the 1:1 from migration 070. A single form may now be the
-- capture for several outcomes — submitting it enrolls the contact
-- into every linked outcome's workflows. Replaces the unique index
-- with a plain lookup index (the enrollment hook filters
-- event_outcomes by form_id on every submission).
--
-- Additive / non-destructive: only swaps an index.
-- ============================================================

DROP INDEX IF EXISTS public.uq_event_outcomes_form;

CREATE INDEX IF NOT EXISTS idx_event_outcomes_form
  ON public.event_outcomes (form_id) WHERE form_id IS NOT NULL;

COMMENT ON COLUMN public.event_outcomes.form_id IS
  'The form that captures responses for this outcome. A form MAY be shared across multiple outcomes; submitting it enrolls the contact into each linked outcome''s workflows.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   -- unique index gone, plain index present:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'event_outcomes' AND indexname LIKE '%form%';
--   -- expect: idx_event_outcomes_form  (NOT uq_event_outcomes_form)
-- ============================================================
