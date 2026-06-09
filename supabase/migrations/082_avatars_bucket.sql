-- ============================================================
-- FFSA Hub — Migration 082: User avatars storage bucket
-- ============================================================
-- public.users.avatar_url already exists (migration 001) but has
-- never been written to. This migration creates the storage bucket
-- that the new avatar upload API writes into.
--
-- Modeled on migration 055 (event-logos): public-read so the avatar
-- can render anywhere without signed URLs; uploads go through an
-- admin-client API route (service role), so no INSERT/UPDATE policy
-- on storage.objects is needed.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  1048576,  -- 1 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT id, public, file_size_limit FROM storage.buckets
--   WHERE id = 'avatars';
--   -- one row, public = true, file_size_limit = 1048576
-- ============================================================
