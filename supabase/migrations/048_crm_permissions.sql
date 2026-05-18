-- ============================================================
-- FFSA Hub — Migration 048: CRM permission rows
-- ============================================================
-- Inserts the permission-key rows the CRM uses. The permissions
-- + user_permissions tables already exist (migration 014); we're
-- just adding the master-list rows. Existing roles still work as
-- a coarser check (is_admin / has_role) — these permissions give
-- fine-grained control for non-admin staff.
--
-- Spec: FFSA_Hub_CRM_Spec.md §9
-- ============================================================

INSERT INTO public.permissions (module, key, display_name, sort_order) VALUES
  ('contacts',       'contacts.read',          'View contacts',                       100),
  ('contacts',       'contacts.write',         'Create / edit contacts',              110),
  ('contacts',       'contacts.export',        'Export contact data',                 120),
  ('contacts',       'contacts.delete',        'Delete / RTBF contacts',              130),
  ('contacts',       'contacts.dedup_review',  'Resolve duplicate-contact reviews',   140),
  ('contacts',       'labels.read',            'View labels',                         150),
  ('contacts',       'labels.manage',          'Create / edit / delete labels',       160),
  ('contacts',       'imports.run',            'Run CSV imports',                     170),
  ('communications', 'forms.read',             'View forms',                          200),
  ('communications', 'forms.manage',           'Create / edit / publish forms',       210),
  ('communications', 'campaigns.read',         'View campaigns + analytics',          220),
  ('communications', 'campaigns.draft',        'Create / edit campaign drafts',       230),
  ('communications', 'campaigns.send',         'Send / schedule campaigns',           240),
  ('communications', 'unsubscribes.manage',    'Manage unsubscribes + suppressions',  250)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT module, key, display_name FROM public.permissions
--   WHERE key LIKE 'contacts.%'
--      OR key LIKE 'labels.%'
--      OR key LIKE 'forms.%'
--      OR key LIKE 'campaigns.%'
--      OR key LIKE 'imports.%'
--      OR key LIKE 'unsubscribes.%'
--   ORDER BY sort_order;
--   -- expect 14 rows
-- ============================================================
