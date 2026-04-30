-- ============================================================
-- Update outreach budget categories to match spreadsheet
-- ============================================================

-- Rename "Airport Transport" → "Airport Run" to match spreadsheet
UPDATE public.outreach_budget_categories
SET name = 'Airport Run', slug = 'airport-run'
WHERE slug = 'airport-transport';

-- Rename "Ministry Supplies" → "Ministry" to match spreadsheet
UPDATE public.outreach_budget_categories
SET name = 'Ministry', slug = 'ministry'
WHERE slug = 'ministry-supplies';

-- Add missing categories from the spreadsheet
INSERT INTO public.outreach_budget_categories (name, slug, description, is_default, sort_order)
VALUES
  ('Pastoral Visit', 'pastoral-visit', 'Pastoral visit costs during outreach', true, 16),
  ('Surprise',       'surprise',       'Surprise/contingency fund',            true, 17),
  ('Accommodation',  'accommodation',  'Accommodation costs',                  true, 18)
ON CONFLICT (slug) DO NOTHING;
