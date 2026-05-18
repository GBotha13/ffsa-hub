-- ============================================================
-- FFSA Hub — Migration 041: Extend contacts for CRM
-- ============================================================
-- Adds the demographic, ownership, marketing-state, and
-- normalized-key columns the CRM needs on top of the existing
-- (deliberately slim) contacts table from migration 005.
--
-- Why these columns are coming back: migration 005 stripped
-- demographic fields out of contacts because at that time
-- "contacts" meant the lightweight CRM directory and richer
-- detail belonged on users (staff/students). The CRM build now
-- needs those fields on the contact side for marketing
-- segmentation, profile completeness, and POPIA reporting.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.1
-- Append-only. No data destruction.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Demographic + intake fields
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS date_of_birth        date,
  ADD COLUMN IF NOT EXISTS marital_status       text,
  ADD COLUMN IF NOT EXISTS gender               text,
  ADD COLUMN IF NOT EXISTS nationality          text,
  ADD COLUMN IF NOT EXISTS preferred_language   text,
  ADD COLUMN IF NOT EXISTS preferred_channel    text DEFAULT 'email'
    CHECK (preferred_channel IN ('email', 'whatsapp', 'sms')),
  ADD COLUMN IF NOT EXISTS source               text,
  ADD COLUMN IF NOT EXISTS owner_id             uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Marketing state
-- ────────────────────────────────────────────────────────────
-- 'subscribed'         — receives campaigns the contact's labels target
-- 'unsubscribed_all'   — global opt-out, suppressed regardless of labels
-- 'bounced'            — hard-bounce suppression set by webhook handler
-- 'pending'            — double-opt-in not yet confirmed
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS marketing_status text NOT NULL DEFAULT 'subscribed'
    CHECK (marketing_status IN ('subscribed', 'unsubscribed_all', 'bounced', 'pending'));

-- ────────────────────────────────────────────────────────────
-- 3. last_interaction_at
-- ------------------------------------------------------------
-- Populated by a trigger on activity_events INSERT (added in
-- migration 043, once activity_events exists). For now we
-- backfill with created_at so existing contacts have a value.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

UPDATE public.contacts
SET last_interaction_at = created_at
WHERE last_interaction_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- 4. Normalized dedup keys
-- ------------------------------------------------------------
-- email_normalized — generated, always equals lower(trim(email))
-- phone_normalized — populated by the application layer using
--   libphonenumber-js (E.164). CHECK constraint asserts shape.
-- Both are nullable because contacts may have only one of the
-- two on file. Dedup uses (email_normalized OR phone_normalized).
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_normalized text
    GENERATED ALWAYS AS (lower(btrim(email))) STORED;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_normalized text
    CHECK (phone_normalized IS NULL OR phone_normalized ~ '^\+[1-9][0-9]{6,14}$');

-- ────────────────────────────────────────────────────────────
-- 5. Indexes
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_email_normalized
  ON public.contacts (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized
  ON public.contacts (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_owner
  ON public.contacts (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_marketing_status
  ON public.contacts (marketing_status);

CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction
  ON public.contacts (last_interaction_at DESC NULLS LAST);

-- ────────────────────────────────────────────────────────────
-- 6. Comments (for the Supabase Table Editor + future readers)
-- ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.contacts.preferred_channel IS
  'How this contact prefers to be reached. Used by Communication module to pick channel when multiple are available (v3 = WhatsApp).';

COMMENT ON COLUMN public.contacts.source IS
  'Free-text origin string. Examples: csv:send-2026, form:newsletter-signup, manual:jack@…. First touchpoint, not authoritative for current interests (labels are).';

COMMENT ON COLUMN public.contacts.owner_id IS
  'Internal staff member responsible for this contact. Optional. Used for scoped permissions (e.g. "my contacts" view).';

COMMENT ON COLUMN public.contacts.marketing_status IS
  'Top-level marketing eligibility. Per-label opt-outs live in the unsubscribes table (migration 046).';

COMMENT ON COLUMN public.contacts.last_interaction_at IS
  'Most recent activity_events.occurred_at for this contact. Maintained by trigger from migration 043 onward.';

COMMENT ON COLUMN public.contacts.email_normalized IS
  'Generated column: lower(btrim(email)). Used for case-insensitive dedup matching. Indexed.';

COMMENT ON COLUMN public.contacts.phone_normalized IS
  'E.164-formatted phone (e.g. +27821234567). Populated by application layer using libphonenumber-js. Used for dedup matching. Indexed.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
-- After applying, in Supabase SQL Editor run:
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'contacts'
--   ORDER BY ordinal_position;
--
-- Expect to see all the new columns. Then:
--
--   SELECT count(*) FROM public.contacts WHERE last_interaction_at IS NULL;
--
-- Should return 0 (backfill succeeded).
-- ============================================================
