-- ============================================================
-- FFSA Hub — Multi-region Xero support
-- ============================================================
-- Adds a 'region' column to xero_tokens so we can store
-- separate OAuth connections for SA (default) and US orgs.
-- ============================================================

ALTER TABLE public.xero_tokens ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'za';

-- Allow multiple rows (one per region) — remove the old approach
-- of deleting all tokens before inserting
