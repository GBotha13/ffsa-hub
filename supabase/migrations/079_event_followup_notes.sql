-- ============================================================
-- FFSA Hub — Migration 079: Event Follow-up per-person notes
-- ============================================================
-- Single free-form notes field per workflow_enrollment so the
-- assigned staff member can keep running track of important
-- details as the follow-up process progresses.
--
-- Edit-in-place (not an append-only timeline). last_updated_at
-- and last_updated_by capture provenance so the drawer can show
-- "edited by X at Y" without joining audit tables.
--
-- All additive. Existing rows get NULL, which is the natural
-- "no notes yet" state.
-- ============================================================

ALTER TABLE public.workflow_enrollments
  ADD COLUMN IF NOT EXISTS staff_notes               text,
  ADD COLUMN IF NOT EXISTS staff_notes_updated_at    timestamptz,
  ADD COLUMN IF NOT EXISTS staff_notes_updated_by    uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.workflow_enrollments.staff_notes IS
  'Free-form notes the assigned staff member keeps while following up. Edit-in-place; activity_events captures the trail of changes via the followup_note event_type.';

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='workflow_enrollments'
--     AND column_name IN ('staff_notes','staff_notes_updated_at','staff_notes_updated_by');
--   -- expect 3 rows
-- ============================================================
