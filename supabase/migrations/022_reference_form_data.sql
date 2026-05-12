-- ============================================================
-- Add form_data JSONB column to reference_requests
-- Stores structured reference form answers (character ratings,
-- short answers, recommendation, etc.)
-- ============================================================

ALTER TABLE public.reference_requests
  ADD COLUMN IF NOT EXISTS form_data jsonb DEFAULT '{}';
