-- ============================================================
-- FFSA Hub — Migration 049: Helper views for the CRM
-- ============================================================
-- Two read-side views that simplify queries from the app layer:
--   1. v_contact_summary — one row per contact with label slugs
--      aggregated + counts of recent activity + last interaction
--   2. v_campaign_audience — for a given label_id, the contact
--      list that would be targeted (minus unsubscribes,
--      suppressions, and non-subscribed marketing_status)
--
-- Views inherit RLS from underlying tables, so no extra policy
-- work is needed.
--
-- Spec: FFSA_Hub_CRM_Spec.md §5, §7
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- v_contact_summary
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_contact_summary AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.marketing_status,
  c.last_interaction_at,
  c.owner_id,
  COALESCE(
    array_agg(DISTINCT l.slug ORDER BY l.slug) FILTER (WHERE l.id IS NOT NULL),
    ARRAY[]::text[]
  ) AS label_slugs,
  COUNT(DISTINCT cl.label_id) AS label_count,
  COUNT(DISTINCT ae.id) AS activity_count
FROM public.contacts c
LEFT JOIN public.contact_labels cl ON cl.contact_id = c.id
LEFT JOIN public.labels         l  ON l.id  = cl.label_id AND l.is_active = true
LEFT JOIN public.activity_events ae ON ae.contact_id = c.id
GROUP BY c.id;

COMMENT ON VIEW public.v_contact_summary IS
  'One row per contact with aggregated label slugs and counts. Used by the contacts list page.';

-- ────────────────────────────────────────────────────────────
-- v_campaign_audience
-- ------------------------------------------------------------
-- Resolves a label_id to the set of contacts that would receive
-- a campaign for that label. Applied filters:
--   - contact holds the label (contact_labels)
--   - contact is not globally unsubscribed (marketing_status)
--   - contact has no per-label unsubscribe for THIS label
--   - contact has no global unsubscribe row
--   - contact's email is not in email_suppressions
--   - contact has an email at all
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_campaign_audience AS
SELECT
  cl.label_id,
  c.id          AS contact_id,
  c.email,
  c.email_normalized,
  c.first_name,
  c.last_name
FROM public.contact_labels cl
JOIN public.contacts c ON c.id = cl.contact_id
WHERE c.email IS NOT NULL
  AND c.email_normalized IS NOT NULL
  AND c.marketing_status = 'subscribed'
  AND NOT EXISTS (
    SELECT 1 FROM public.unsubscribes u
    WHERE u.contact_id = c.id
      AND (u.label_id = cl.label_id OR u.label_id IS NULL)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.email_suppressions s
    WHERE s.email_normalized = c.email_normalized
  );

COMMENT ON VIEW public.v_campaign_audience IS
  'For each (label_id, contact), the contacts that should actually receive a campaign for that label. Query by label_id from the send worker.';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.v_contact_summary;     -- 0
--   SELECT count(*) FROM public.v_campaign_audience;   -- 0
--   \d+ public.v_contact_summary
-- ============================================================
