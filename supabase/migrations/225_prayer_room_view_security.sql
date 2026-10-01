-- ============================================================
-- FFSA Hub — Migration 225: prayer room view security (Supabase advisor)
-- ============================================================
-- The Security Advisor flags two SECURITY DEFINER views. They are not alike:
--
-- 1. prayer_room_open_slots (migration 084) — a REAL leak. A definer view
--    skips the RLS on prayer_room_sets / prayer_room_set_slots, and those
--    policies are TO authenticated only. Through the view, the public anon key
--    could list every open slot, set titles included (some titles are
--    people's names). Verified with the anon key on 2026-10-01.
--    Signed-in users lose nothing by switching to invoker rights: both base
--    tables are readable to every authenticated user.
--
-- 2. prayer_room_my_evaluations (migration 169) — owner rights ON PURPOSE.
--    It is hard-filtered to auth.uid() and leaves out private_note; the base
--    table is closed to the person evaluated, so invoker rights would return
--    nothing. Anonymous callers already get zero rows (auth.uid() is null);
--    the grant is revoked anyway so the view has no anon surface at all.
--    The advisor will keep flagging this one; that is expected.
-- ============================================================

ALTER VIEW public.prayer_room_open_slots SET (security_invoker = true);
REVOKE ALL ON public.prayer_room_open_slots FROM anon;

REVOKE ALL ON public.prayer_room_my_evaluations FROM anon;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT relname, reloptions FROM pg_class
--    WHERE relname IN ('prayer_room_open_slots', 'prayer_room_my_evaluations');
--   -- open_slots: {security_invoker=true}; my_evaluations: NULL (by design)
-- ============================================================

-- ROLLBACK:
--   ALTER VIEW public.prayer_room_open_slots SET (security_invoker = false);
--   GRANT SELECT ON public.prayer_room_open_slots, public.prayer_room_my_evaluations TO anon;
