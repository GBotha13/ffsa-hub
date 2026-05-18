-- ============================================================
-- FFSA Hub — Migration 050: Minimal CRM seed
-- ============================================================
-- Seeds two obvious preset labels so the system has something
-- pointing at the default sending identity out of the box. The
-- full preset list will be added by the user via the labels UI
-- (per spec §14 — "Preset label list" open question).
--
-- Both labels point at the default-marketing sending identity
-- seeded in migration 042. Update via UI once real Mailtrap
-- identities are configured.
--
-- Spec: FFSA_Hub_CRM_Spec.md §14 (Open question: preset labels)
-- ============================================================

INSERT INTO public.labels (slug, name, description, category, is_preset, sending_identity_id)
SELECT
  v.slug, v.name, v.description, v.category, true, si.id
FROM (VALUES
  ('newsletter', 'Newsletter',    'General ministry newsletter subscribers.',           'General'),
  ('donors',     'Donors',        'Contacts who have given financially to the ministry.', 'Donors')
) AS v(slug, name, description, category)
CROSS JOIN (
  SELECT id FROM public.sending_identities WHERE slug = 'default-marketing' LIMIT 1
) AS si
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT slug, name, is_preset FROM public.labels ORDER BY slug;
--   -- expect: donors, newsletter (both is_preset = true)
-- ============================================================
