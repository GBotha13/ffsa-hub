-- ============================================================
-- FFSA Hub — Revert the global is_assignable_contact flag.
-- ============================================================
-- Replaced by program-scoped permission `schools.assignable_as_contact`
-- (see migration 055). This keeps the picker eligibility unified
-- with the rest of the schools permission model.
-- ============================================================

DROP INDEX IF EXISTS public.idx_users_is_assignable_contact;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS is_assignable_contact;
