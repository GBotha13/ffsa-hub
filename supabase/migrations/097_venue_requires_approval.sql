-- ============================================================
-- FFSA Hub — Migration 097: Per-venue approval control
-- ============================================================
-- Space bookings now AUTO-CONFIRM by default for anyone with booking
-- permission. The space-booking manager can flag individual venues that
-- still require manual approval (e.g. high-demand or sensitive spaces).
--
--   requires_approval = false (default) → bookings are confirmed instantly
--   requires_approval = true            → bookings go to the manager as pending
--
-- Managers / approvers always auto-confirm their own bookings regardless of
-- this flag. A booking that would clash with an existing live booking on an
-- auto-confirm space is BLOCKED at creation time (no silent double-booking).
-- ============================================================

ALTER TABLE public.venues
  ADD COLUMN requires_approval boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.venues.requires_approval IS
  'When true, bookings for this space go to the manager as pending; when false (default), bookings by permitted users auto-confirm.';
