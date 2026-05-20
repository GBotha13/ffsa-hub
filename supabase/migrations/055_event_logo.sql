-- ============================================================
-- FFSA Hub — Migration 055: Event logo (per-event branding)
-- ============================================================
-- Adds a logo to events. Every form attached to an event renders
-- the event's logo on its public page, so branding is set once
-- per event rather than per form.
--
-- Creates a public storage bucket for the uploaded logo files.
-- Public-read is fine — logos are shown on public form pages.
-- Uploads go through an admin-client API route (service role),
-- so no INSERT policy is needed.
-- ============================================================

-- 1. events.logo_url
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.events.logo_url IS
  'Public URL of the event logo (stored in the event-logos bucket). Shown on every form attached to this event.';

-- 2. Storage bucket for event logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-logos',
  'event-logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT id, public FROM storage.buckets WHERE id = 'event-logos';
--   -- one row, public = true
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'events' AND column_name = 'logo_url';
-- ============================================================
