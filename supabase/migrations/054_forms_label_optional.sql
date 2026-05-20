-- ============================================================
-- FFSA Hub — Migration 054: forms.label_id is optional
-- ============================================================
-- Migration 044 created forms.label_id as NOT NULL on the
-- assumption every form has a base label. The Events integration
-- breaks that assumption:
--   - an event may have no base_label_id yet
--   - a form may be intentionally outcome-only (labels applied
--     purely by outcome-response fields, no blanket base label)
--
-- Creating a form for an event without a base label hit
-- "null value in column label_id violates not-null constraint".
--
-- Fix: drop the NOT NULL. The FK to labels(id) is unchanged, so
-- a non-null value still must reference a real label.
--
-- Caught by E2E test on 2026-05-20.
-- ============================================================

ALTER TABLE public.forms
  ALTER COLUMN label_id DROP NOT NULL;

COMMENT ON COLUMN public.forms.label_id IS
  'Optional base label applied to every submission. Null = no blanket label (e.g. an outcome-only form). Per-outcome labels are applied by outcome fields regardless.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT is_nullable FROM information_schema.columns
--   WHERE table_name='forms' AND column_name='label_id';
--   -- expect 'YES'
-- ============================================================
