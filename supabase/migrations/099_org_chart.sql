-- ============================================================
-- FFSA Hub — Migration 099: Org Chart module
-- ============================================================
-- A living, interactive org chart — a "glorified org chart" styled
-- like Supabase's schema visualizer. Renders FFSA's 2026 structure
-- ("Rooted & Sent") as an expandable canvas of nodes + connectors.
--
-- Data model (generic / hand-authored, NOT derived from users):
--   org_charts  — a named chart (supports >1 later: "Leadership", …)
--   org_nodes   — every box. Self-referential via parent_id (the tree).
--                 `key` is a stable human slug so the seed + edges are
--                 readable and order-independent.
--   org_edges   — NON-hierarchical connectors only (cross-team service,
--                 the Missio "alongside" structure). The tree itself is
--                 drawn from parent_id; edges add the dotted relationships.
--
-- Permissions (module = 'org-chart'):
--   org.view    — (reserved) explicit view grant
--   org.manage  — author / edit the chart (v2 editor)
-- Viewing is open to ANY authenticated user — the chart is internal
-- reference material meant to orient "anyone working in the app".
--
-- Layout: node x/y are OPTIONAL overrides. The viewer auto-lays-out the
-- hierarchy with dagre at load, so the seed need not place pixels.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Access helper
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_org_chart_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_permission('org.manage');
$$;

-- ────────────────────────────────────────────────────────────
-- 1. CHARTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.org_charts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. NODES (the boxes — a tree via parent_id)
-- ────────────────────────────────────────────────────────────
-- kind drives the visual treatment in the viewer:
--   root     — the organisation itself
--   cluster  — Outward / Inward / Backbone
--   team     — a ministry team
--   subteam  — a department / sub-unit within a team
--   person   — a named staff member
--   role     — an unfilled / structural role (e.g. "Integrator — open")
--   stream   — a parallel structure node (Missio Church chain)
CREATE TABLE public.org_nodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id      uuid NOT NULL REFERENCES public.org_charts (id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES public.org_nodes (id) ON DELETE CASCADE,
  key           text NOT NULL,            -- stable slug, unique per chart
  kind          text NOT NULL DEFAULT 'person'
                CHECK (kind IN ('root','cluster','team','subteam','person','role','stream')),
  label         text NOT NULL,            -- primary line (name / team)
  subtitle      text,                     -- role / description line
  accent        text,                     -- cluster colour key: gold|green|copper|sand|slate|outward|inward|backbone
  headcount     integer,                  -- shown as a pill on team nodes
  status        text,                     -- e.g. 'open', 'developing', 'temp'
  person_id     uuid REFERENCES public.users (id) ON DELETE SET NULL, -- optional deep-link
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  collapsed     boolean NOT NULL DEFAULT false, -- default-collapsed in the viewer
  x             numeric,                   -- optional manual position override
  y             numeric,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chart_id, key)
);

CREATE INDEX idx_org_nodes_chart  ON public.org_nodes (chart_id);
CREATE INDEX idx_org_nodes_parent ON public.org_nodes (parent_id);

-- ────────────────────────────────────────────────────────────
-- 3. EDGES (non-hierarchical connectors)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.org_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id    uuid NOT NULL REFERENCES public.org_charts (id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES public.org_nodes (id) ON DELETE CASCADE,
  target_id   uuid NOT NULL REFERENCES public.org_nodes (id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'cross_team'
              CHECK (kind IN ('cross_team','parallel','dotted')),
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_edges_chart ON public.org_edges (chart_id);

-- ────────────────────────────────────────────────────────────
-- 4. PERMISSIONS
-- ────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module, key, display_name, sort_order) VALUES
  ('org-chart', 'org.view',   'View Org Chart',   10),
  ('org-chart', 'org.manage', 'Manage Org Chart', 20)
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.org_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_nodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_edges  ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (internal reference material).
CREATE POLICY "org_charts_read" ON public.org_charts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_nodes_read" ON public.org_nodes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_edges_read" ON public.org_edges
  FOR SELECT TO authenticated USING (true);

-- Write: admins or holders of org.manage (reserved for the v2 editor).
CREATE POLICY "org_charts_manage" ON public.org_charts
  FOR ALL TO authenticated
  USING (public.has_org_chart_manage()) WITH CHECK (public.has_org_chart_manage());
CREATE POLICY "org_nodes_manage" ON public.org_nodes
  FOR ALL TO authenticated
  USING (public.has_org_chart_manage()) WITH CHECK (public.has_org_chart_manage());
CREATE POLICY "org_edges_manage" ON public.org_edges
  FOR ALL TO authenticated
  USING (public.has_org_chart_manage()) WITH CHECK (public.has_org_chart_manage());

-- ============================================================
-- 6. SEED — FFSA 2026 "Rooted & Sent" structure
-- ============================================================
-- Authored from the 2026 Organisational Structure document.
-- Staging temp tables make the seed readable and order-independent:
-- insert every node flat, then resolve parent_id / edges by `key`.

DO $$
DECLARE
  v_chart uuid;
BEGIN

INSERT INTO public.org_charts (name, slug, description, sort_order)
VALUES ('FFSA 2026', 'ffsa-2026',
        'Rooted & Sent — Fire & Fragrance South Africa organisational structure, 2026.', 0)
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description
RETURNING id INTO v_chart;

-- Fresh seed each apply (idempotent re-seed of this chart's nodes/edges).
DELETE FROM public.org_edges WHERE chart_id = v_chart;
DELETE FROM public.org_nodes WHERE chart_id = v_chart;

CREATE TEMP TABLE _seed (
  key text, parent_key text, kind text, label text, subtitle text,
  accent text, headcount int, status text, collapsed boolean, sort_order int
) ON COMMIT DROP;

CREATE TEMP TABLE _seed_edges (
  source_key text, target_key text, kind text, label text
) ON COMMIT DROP;

-- ── Apex ────────────────────────────────────────────────────
INSERT INTO _seed VALUES
('ffsa', NULL, 'root', 'Fire & Fragrance SA', 'Potchefstroom · 2026 · 157 staff', 'gold', 157, NULL, false, 0),
('leadership', 'ffsa', 'team', 'Leadership Team', 'Governance & senior oversight', 'gold', 8, NULL, false, 0),
('integrator', 'leadership', 'role', 'Integrator', 'Day-to-day execution · alignment · accountability', 'copper', NULL, 'open', false, 1);

-- Leadership Team members
INSERT INTO _seed VALUES
('p-sample244',  'leadership', 'person', 'Sample Person 244',        'Senior Leader · Visionary (EOS) · Base Leader', 'gold', NULL, NULL, false, 0),
('p-michelle', 'leadership', 'person', 'Sample Person 492',       'COO · Operations owner',                        'gold', NULL, NULL, false, 1),
('p-sample21',  'leadership', 'person', 'Sample Person 21',  'Business Development & Corporate Fundraising',   'gold', NULL, NULL, false, 2),
('p-sample240',   'leadership', 'person', 'Sample Person 240',  'Project 54 core · Nigeria nations leader',       'gold', NULL, NULL, false, 3),
('p-sample246',    'leadership', 'person', 'Sample Person 246', 'Project 54 core · Madagascar & Malawi leader',   'gold', NULL, NULL, false, 4),
('p-sample248',     'leadership', 'person', 'Sample Person 248',           'Training Director',                              'gold', NULL, NULL, false, 5),
('p-ally',     'leadership', 'person', 'Sample Person 402',           'Inside Ministry · OKRs (role developing)',       'gold', NULL, NULL, false, 6),
('p-caleb',    'leadership', 'person', 'Sample Person 24',          'Outside Ministry · Leadership Dev (developing)',  'gold', NULL, NULL, false, 7);

-- ── Clusters ────────────────────────────────────────────────
INSERT INTO _seed VALUES
('cluster-outward',  'integrator', 'cluster', 'Outward · Mission',   'Sending into the nations',        'outward',  NULL, NULL, false, 0),
('cluster-inward',   'integrator', 'cluster', 'Inward · Formation',  'Forming disciples & leaders',     'inward',   NULL, NULL, false, 1),
('cluster-backbone', 'integrator', 'cluster', 'Backbone · Support',  'The base that carries the load',  'backbone', NULL, NULL, false, 2);

-- ════════════════════════════════════════════════════════════
-- OUTWARD · MISSION
-- ════════════════════════════════════════════════════════════
INSERT INTO _seed VALUES
('team-outside',   'cluster-outward', 'team', 'Outside Ministry', 'External outreach · leadership development', 'outward', NULL, NULL, false, 0),
('team-hulc',      'cluster-outward', 'team', 'HULC',             'University, campus & high-school mission',   'outward', 21,   NULL, true,  1),
('team-events',    'cluster-outward', 'team', 'Events',           'The Send · FFX · FFBX · national mobilisation','outward', 7,   NULL, true,  2),
('team-p54',       'cluster-outward', 'team', 'Project 54',       'African nations mission · 10/40 window',     'outward', 25,   NULL, true,  3),
('team-crossfit',  'cluster-outward', 'team', '10/40 CrossFit',   'Discipleship through strength & community',  'outward', 7,    NULL, true,  4),
('team-woven',     'cluster-outward', 'team', 'Woven',            'Sample Person 486 · women''s ministry · Restoration',    'outward', 6,    NULL, true,  5);

-- Outside Ministry
INSERT INTO _seed VALUES
('om-caleb', 'team-outside', 'person', 'Sample Person 24', 'Outside Ministry lead · Leadership Development', 'outward', NULL, NULL, false, 0);

-- HULC (21) — Sample Person 247 lead
INSERT INTO _seed VALUES
('hulc-core',    'team-hulc', 'subteam', 'Core Leadership',        '6',           'outward', 6, NULL, false, 0),
('hulc-campus',  'team-hulc', 'subteam', 'Campus Leaders',         '9',           'outward', 9, NULL, false, 1),
('hulc-schools', 'team-hulc', 'subteam', 'High Schools & Pipeline','6',           'outward', 6, NULL, false, 2);
INSERT INTO _seed VALUES
('h-sample247',   'hulc-core', 'person', 'Sample Person 247', 'Visionary / Apostolic Architect · camps · Rev & Ref', 'outward', NULL, NULL, false, 0),
('h-sample244b',  'hulc-core', 'person', 'Sample Person 244', 'Mobilisation Strategy Architect · campus activation', 'outward', NULL, NULL, false, 1),
('h-luke',       'hulc-core', 'person', 'Sample Person 475', 'OTC Leader · SU point leader · Cape Town camps', 'outward', NULL, NULL, false, 2),
('h-sarah',      'hulc-core', 'person', 'Sample Person 226', 'Formation & Empowerment · Brave Love lead · HS pipeline', 'outward', NULL, NULL, false, 3),
('h-ellie',      'hulc-core', 'person', 'Sample Person 437', 'Executive Coordination · alignment tracking', 'outward', NULL, NULL, false, 4),
('h-lene',       'hulc-core', 'person', 'Sample Person 472', 'Messaging · curriculum · theological consistency · OTC', 'outward', NULL, NULL, false, 5),
('h-wimpie',     'hulc-campus', 'person', 'Sample Person 533', 'Training & formation · TUKS + UJ support · worship', 'outward', NULL, NULL, false, 0),
('h-ashlyn',     'hulc-campus', 'person', 'Sample Person 410', 'Comms & campaigns · TUKS + UJ support leader', 'outward', NULL, NULL, false, 1),
('h-tshego',     'hulc-campus', 'person', 'Sample Person 527', 'Media lead: camps organiser · TUKS + UJ point leader', 'outward', NULL, NULL, false, 2),
('h-chandre',    'hulc-campus', 'person', 'Sample Person 418', 'Finance owner · UFS + CUT point leader · Brave Love', 'outward', NULL, NULL, false, 3),
('h-ray',        'hulc-campus', 'person', 'Sample Person 506', 'UFS + CUT support · Rev & Ref leader · worship', 'outward', NULL, NULL, false, 4),
('h-tj',         'hulc-campus', 'person', 'Sample Person 526', 'NWU point leader', 'outward', NULL, NULL, false, 5),
('h-chanelle',   'hulc-campus', 'person', 'Sample Person 419', 'NWU support leader · Brave Love', 'outward', NULL, NULL, false, 6),
('h-meshach',    'hulc-campus', 'person', 'Sample Person 488', 'UCT point leader · HULC worship', 'outward', NULL, NULL, false, 7),
('h-lauren',     'hulc-campus', 'person', 'Sample Person 471', 'SU + UCT support · Brave Love · worship', 'outward', NULL, NULL, false, 8),
('h-nissi',      'hulc-schools', 'person', 'Sample Person 501', 'High Schools team · HULC media · development pathway', 'outward', NULL, NULL, false, 0),
('h-hesmari',    'hulc-schools', 'person', 'Sample Person 446', 'UFS + CUT support · farm-town pipeline · worship', 'outward', NULL, NULL, false, 1),
('h-devan',      'hulc-schools', 'person', 'Sample Person 434', 'High Schools team · HULC worship', 'outward', NULL, NULL, false, 2),
('h-alison',     'hulc-schools', 'person', 'Sample Person 401', 'High Schools · NWU support · HULC media', 'outward', NULL, NULL, false, 3),
('h-deone',      'hulc-schools', 'person', 'Sample Person 433', 'High Schools · NWU support · HULC media', 'outward', NULL, NULL, false, 4),
('h-japie',      'hulc-schools', 'person', 'Sample Person 455', 'Part-time with OPS & SBS', 'outward', NULL, NULL, false, 5);

-- Events (7) — Sample Person 244 mobilisation (cross-team members shown via edges)
INSERT INTO _seed VALUES
('e-ellievw',   'team-events', 'person', 'Sample Person 438', 'Event support · team member', 'outward', NULL, NULL, false, 0);

-- Project 54 (25) — Sample Person 240 · Sample Person 246 · Veronica · Sample Person 486 core
INSERT INTO _seed VALUES
('p54-core',    'team-p54', 'subteam', 'Core Leadership', '4', 'outward', 4, NULL, false, 0),
('p54-team',    'team-p54', 'subteam', 'Team Directory',  '21 members', 'outward', 21, NULL, false, 1);
INSERT INTO _seed VALUES
('p54-veronica','p54-core', 'person', 'Sample Person 530', 'Network Mobilisation · Training Point Leader · Nigeria', 'outward', NULL, NULL, false, 0),
('p54-mercy',   'p54-core', 'person', 'Sample Person 487', 'Leadership Development · OKR Shepherd · Tanzania', 'outward', NULL, NULL, false, 1),
('p54-bianca',  'p54-team', 'person', 'Sample Person 19 Venter', 'Media Ops Lead · Madagascar · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 0),
('p54-carla',   'p54-team', 'person', 'Sample Person 415', 'Training Ops Lead · Nigeria · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 1),
('p54-hanna',   'p54-team', 'person', 'Sample Person 442', 'Training Ops · Nigeria · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 2),
('p54-helanca', 'p54-team', 'person', 'Sample Person 444', 'Development Ops · Malawi · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 3),
('p54-isabelle','p54-team', 'person', 'Sample Person 449', 'Madagascar · Training Assistant · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 4),
('p54-jenna',   'p54-team', 'person', 'Sample Person 456', 'Nigeria · Training Assistant · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 5),
('p54-jeremy',  'p54-team', 'person', 'Sample Person 457', 'Church Planter · Training Assistant · DMM Coach', 'outward', NULL, NULL, false, 6),
('p54-jessica', 'p54-team', 'person', 'Sample Person 458', 'Malawi · Training Assistant · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 7),
('p54-josiah',  'p54-team', 'person', 'Sample Person 462', 'Prayer & Worship Ops Lead · Madagascar · Church Planter', 'outward', NULL, NULL, false, 8),
('p54-sample119', 'p54-team', 'person', 'Sample Person 119', 'Media Ops · Tanzania · Training Assistant · DMM Coach', 'outward', NULL, NULL, false, 9),
('p54-maggie',  'p54-team', 'person', 'Sample Person 477', 'Prayer & Worship Ops · Tanzania · Training Assistant', 'outward', NULL, NULL, false, 10),
('p54-matthewa','p54-team', 'person', 'Sample Person 483', 'Development Ops Lead · Malawi · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 11),
('p54-mia',     'p54-team', 'person', 'Sample Person 489', 'Tanzania · Church Planter · DMM Coach · Intercessor', 'outward', NULL, NULL, false, 12),
('p54-michaels','p54-team', 'person', 'Sample Person 491', 'Training Ops · Malawi · Training Assistant · DMM Coach', 'outward', NULL, NULL, false, 13),
('p54-milly',   'p54-team', 'person', 'Sample Person 494', 'Nigeria · Training Assistant · Church Planter', 'outward', NULL, NULL, false, 14),
('p54-nythan',  'p54-team', 'person', 'Sample Person 502', 'Development Ops · Nigeria · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 15),
('p54-ruan',    'p54-team', 'person', 'Sample Person 509', 'Tanzania · Training Assistant · Church Planter · DMM Coach', 'outward', NULL, NULL, false, 16),
('p54-samantha','p54-team', 'person', 'Sample Person 511', 'Church Planter · DMM Coach · Intercessor', 'outward', NULL, NULL, false, 17),
('p54-taylor',  'p54-team', 'person', 'Sample Person 520', 'Tanzania · Training Facilitator · Church Planter', 'outward', NULL, NULL, false, 18),
('p54-timon',   'p54-team', 'person', 'Sample Person 524', 'Madagascar · Training Facilitator · Church Planter', 'outward', NULL, NULL, false, 19),
('p54-uya',     'p54-team', 'person', 'Sample Person 528', 'Madagascar · Training Assistant · Church Planter', 'outward', NULL, NULL, false, 20);

-- 10/40 CrossFit (7) — Sample Person 261
INSERT INTO _seed VALUES
('cf-sample261',   'team-crossfit', 'person', 'Sample Person 261', 'Octiv & equipment oversight · maintenance · Iran focus', 'outward', NULL, NULL, false, 0),
('cf-shania',  'team-crossfit', 'person', 'Sample Person 514', 'KIDS classes · Devo & Discipleship Dept lead · coaching', 'outward', NULL, NULL, false, 1),
('cf-sample252',  'team-crossfit', 'person', 'Sample Person 461', 'Themes · maintenance (Special Ops) · programming', 'outward', NULL, NULL, false, 2),
('cf-armand',  'team-crossfit', 'person', 'Sample Person 409', 'Equipment lead · Morocco focus · coaching · gym app', 'outward', NULL, NULL, false, 3),
('cf-alyson',  'team-crossfit', 'person', 'Sample Person 403', 'Programming trainer · Media Dept lead · Moms class', 'outward', NULL, NULL, false, 4),
('cf-ruben',   'team-crossfit', 'person', 'Sample Person 510', 'Merch · coaching', 'outward', NULL, NULL, false, 5),
('cf-jp',      'team-crossfit', 'person', 'Sample Person 463', 'New athlete profiles · discipleship map tracker · coaching', 'outward', NULL, NULL, false, 6);

-- Woven (6) — Sample Person 413
INSERT INTO _seed VALUES
('w-caitlin',  'team-woven', 'person', 'Sample Person 413', 'Woven Leader', 'outward', NULL, NULL, false, 0),
('w-hunter',   'team-woven', 'person', 'Sample Person 447', 'Operations & finances · leads Restoration Program', 'outward', NULL, NULL, false, 1),
('w-sample285',    'team-woven', 'person', 'Sample Person 285', 'Evangelism Lead', 'outward', NULL, NULL, false, 2),
('w-dani',     'team-woven', 'person', 'Sample Person 427', 'Media', 'outward', NULL, NULL, false, 3),
('w-timberly', 'team-woven', 'person', 'Sample Person 523', 'Restoration Program support · team trainings', 'outward', NULL, NULL, false, 4),
('w-steph',    'team-woven', 'person', 'Sample Person 517', 'Restoration Program · finances & fundraising · Woven Media', 'outward', NULL, NULL, false, 5);

-- ════════════════════════════════════════════════════════════
-- INWARD · FORMATION
-- ════════════════════════════════════════════════════════════
INSERT INTO _seed VALUES
('team-inside',   'cluster-inward', 'team', 'Inside Ministry', 'Internal formation · OKRs',          'inward', NULL, NULL, false, 0),
('team-training', 'cluster-inward', 'team', 'Training',        'FFX · FFBX · FFSBI · RCA · FFLTrack · EFL', 'inward', 41, NULL, true, 1),
('team-worship',  'cluster-inward', 'team', 'Prayer & Worship','Worship Circle · 24/7 intercession',  'inward', 24, NULL, true, 2);

INSERT INTO _seed VALUES
('im-ally', 'team-inside', 'person', 'Sample Person 402', 'Inside Ministry lead · OKRs', 'inward', NULL, NULL, false, 0);

-- Training (41) — Sample Person 248
INSERT INTO _seed VALUES
('tr-core',  'team-training', 'subteam', 'Core Training Team', 'Coaches & consultants · 5', 'inward', 5, NULL, false, 0),
('tr-ffx',   'team-training', 'subteam', 'FFX',                'Fire & Fragrance eXperience', 'inward', NULL, NULL, false, 1),
('tr-ffbx',  'team-training', 'subteam', 'FFBX',               'FFX Base eXperience', 'inward', NULL, NULL, false, 2),
('tr-ffsbi', 'team-training', 'subteam', 'FFSBI',              'School of Bible Immersion', 'inward', NULL, NULL, false, 3),
('tr-rca',   'team-training', 'subteam', 'RCA',                'Rooted Christian Academy', 'inward', NULL, NULL, false, 4),
('tr-track', 'team-training', 'subteam', 'FFLTrack',           'Leadership track', 'inward', NULL, NULL, false, 5),
('tr-efl',   'team-training', 'subteam', 'EFL',                'Educating For Life', 'inward', NULL, NULL, false, 6);
INSERT INTO _seed VALUES
('tr-ally',    'tr-core', 'person', 'Sample Person 402', 'FFX Coach', 'inward', NULL, NULL, false, 0),
('tr-wikus',   'tr-core', 'person', 'Sample Person 532', 'FFBX Coach', 'inward', NULL, NULL, false, 1),
('tr-mercy',   'tr-core', 'person', 'Sample Person 486', 'Short-form Coach', 'inward', NULL, NULL, false, 2),
('tr-riley',   'tr-core', 'person', 'Sample Person 508', 'FFSBI Coach', 'inward', NULL, NULL, false, 3),
('tr-nathaly', 'tr-core', 'person', 'Sample Person 498', 'Systems Consultant', 'inward', NULL, NULL, false, 4),
('tr-chante',  'tr-ffx', 'person', 'Sample Person 420', 'Point School Leader', 'inward', NULL, NULL, false, 0),
('tr-sarel',   'tr-ffx', 'person', 'Sample Person 512', 'FFX staff', 'inward', NULL, NULL, false, 1),
('tr-anna',    'tr-ffx', 'person', 'Sample Person 406', 'FFX staff', 'inward', NULL, NULL, false, 2),
('tr-beniah',  'tr-ffx', 'person', 'Sample Person 411', 'FFX staff', 'inward', NULL, NULL, false, 3),
('tr-clark',   'tr-ffx', 'person', 'Sample Person 424', 'FFX staff', 'inward', NULL, NULL, false, 4),
('tr-sample252b','tr-ffx', 'person', 'Sample Person 252', 'FFX staff', 'inward', NULL, NULL, false, 5),
('tr-justine', 'tr-ffx', 'person', 'Sample Person 466', 'FFX staff', 'inward', NULL, NULL, false, 6),
('tr-ajn',     'tr-ffx', 'person', 'Sample Person 400', 'FFX staff', 'inward', NULL, NULL, false, 7),
('tr-marneb',  'tr-ffx', 'person', 'Sample Person 482', 'FFX staff', 'inward', NULL, NULL, false, 8),
('tr-naomi',   'tr-ffx', 'person', 'Sample Person 497', 'FFX staff', 'inward', NULL, NULL, false, 9),
('tr-nicole',  'tr-ffx', 'person', 'Sample Person 499', 'FFX staff', 'inward', NULL, NULL, false, 10),
('tr-shanya',  'tr-ffx', 'person', 'Sample Person 515', 'FFX staff', 'inward', NULL, NULL, false, 11),
('tr-stephan', 'tr-ffx', 'person', 'Sample Person 518', 'FFX staff', 'inward', NULL, NULL, false, 12),
('tr-thaddeus','tr-ffx', 'person', 'Sample Person 521', 'FFX staff', 'inward', NULL, NULL, false, 13),
('tr-vanilza', 'tr-ffx', 'person', 'Sample Person 529', 'FFX staff', 'inward', NULL, NULL, false, 14),
('tr-carieke', 'tr-ffx', 'person', 'Sample Person 414', 'FFX staff', 'inward', NULL, NULL, false, 15),
('tr-wikus2',  'tr-ffbx', 'person', 'Sample Person 532', 'FFBX Coach', 'inward', NULL, NULL, false, 0),
('tr-tionne',  'tr-ffbx', 'person', 'Sample Person 525', 'Point School Leader', 'inward', NULL, NULL, false, 1),
('tr-moriah',  'tr-ffbx', 'person', 'Sample Person 496', 'FFBX', 'inward', NULL, NULL, false, 2),
('tr-david',   'tr-ffbx', 'person', 'Sample Person 429', 'FFBX', 'inward', NULL, NULL, false, 3),
('tr-makaio',  'tr-ffbx', 'person', 'Sample Person 478''o', 'FFBX', 'inward', NULL, NULL, false, 4),
('tr-riley2',  'tr-ffsbi', 'person', 'Sample Person 508', 'FFSBI Coach & Point Leader', 'inward', NULL, NULL, false, 0),
('tr-seth',    'tr-ffsbi', 'person', 'Sample Person 513', 'FFSBI co-leader', 'inward', NULL, NULL, false, 1),
('tr-matthewg','tr-ffsbi', 'person', 'Sample Person 485', 'FFSBI co-leader', 'inward', NULL, NULL, false, 2),
('tr-david2',  'tr-ffsbi', 'person', 'Sample Person 430', 'FFSBI staff', 'inward', NULL, NULL, false, 3),
('tr-chanep',  'tr-ffsbi', 'person', 'Sample Person 422', 'FFSBI staff', 'inward', NULL, NULL, false, 4),
('tr-rebecca', 'tr-ffsbi', 'person', 'Sample Person 507', 'FFSBI staff', 'inward', NULL, NULL, false, 5),
('tr-sydney',  'tr-ffsbi', 'person', 'Sample Person 519', 'FFSBI staff', 'inward', NULL, NULL, false, 6),
('tr-elijah',  'tr-ffsbi', 'person', 'Sample Person 436', 'FFSBI staff', 'inward', NULL, NULL, false, 7),
('tr-sharissa','tr-rca', 'person', 'Sample Person 516', 'RCA Principal & Point Leader', 'inward', NULL, NULL, false, 0),
('tr-sample248b',   'tr-track', 'person', 'Sample Person 248', 'Point Leader', 'inward', NULL, NULL, false, 0),
('tr-marlon',  'tr-track', 'person', 'Sample Person 480', 'FFLTrack', 'inward', NULL, NULL, false, 1),
('tr-sample248c',   'tr-efl', 'person', 'Sample Person 248', 'Point Leader', 'inward', NULL, NULL, false, 0),
('tr-cassie',  'tr-efl', 'person', 'Sample Person 417', 'Ministry Leader', 'inward', NULL, NULL, false, 1),
('tr-madri',   'tr-efl', 'person', 'Sample Person 476', 'Team member / Trainer', 'inward', NULL, NULL, false, 2),
('tr-anita',   'tr-ffx', 'person', 'Sample Person 404', 'School Leader', 'inward', NULL, NULL, false, 16),
('tr-delano',  'tr-ffx', 'person', 'Sample Person 432', 'School Leader', 'inward', NULL, NULL, false, 17),
('tr-jurie',   'tr-ffx', 'person', 'Sample Person 465', 'School Leader', 'inward', NULL, NULL, false, 18),
('tr-kelly',   'tr-ffx', 'person', 'Sample Person 469', 'School Leader', 'inward', NULL, NULL, false, 19),
('tr-wayne',   'tr-ffx', 'person', 'Sample Person 531', 'School Leader', 'inward', NULL, NULL, false, 20);

-- Prayer & Worship (24) — Sample Person 431
INSERT INTO _seed VALUES
('wo-heads',   'team-worship', 'subteam', 'Department Heads', '6', 'inward', 6, NULL, false, 0),
('wo-members', 'team-worship', 'subteam', 'Team Members',     '17', 'inward', 17, NULL, false, 1);
INSERT INTO _seed VALUES
('wo-davis',     'team-worship', 'person', 'Sample Person 431', 'Ministry Leader · oversight of all departments', 'inward', NULL, NULL, false, 0),
('wo-cooper',    'wo-heads', 'person', 'Sample Person 426', 'Songwriting · Music Track DTS', 'inward', NULL, NULL, false, 0),
('wo-molly',     'wo-heads', 'person', 'Sample Person 495', 'Outreach / Nations · Songwriting', 'inward', NULL, NULL, false, 1),
('wo-jan',       'wo-heads', 'person', 'Sample Person 453', 'Training', 'inward', NULL, NULL, false, 2),
('wo-bianca',    'wo-heads', 'person', 'Sample Person 19', 'Media', 'inward', NULL, NULL, false, 3),
('wo-jolizna',   'wo-heads', 'person', 'Sample Person 459', 'Prayer Room', 'inward', NULL, NULL, false, 4),
('wo-jack',      'wo-heads', 'person', 'Sample Person 450', 'Production', 'inward', NULL, NULL, false, 5),
('wo-lizaan',    'wo-members', 'person', 'Sample Person 474', 'Songwriting Retreats · Vocal Manager · Worship Leader', 'inward', NULL, NULL, false, 0),
('wo-danielle',  'wo-members', 'person', 'Sample Person 428', 'Nations team · Ministry Night Scheduling', 'inward', NULL, NULL, false, 1),
('wo-jaden',     'wo-members', 'person', 'Sample Person 452', 'Training · Production · Evaluations', 'inward', NULL, NULL, false, 2),
('wo-lise',      'wo-members', 'person', 'Sample Person 473', 'Prayer Room (Burns, Devo Sets)', 'inward', NULL, NULL, false, 3),
('wo-sarahb',    'wo-members', 'person', 'Sample Person 226 Bonn', 'Systems · Scheduling', 'inward', NULL, NULL, false, 4),
('wo-julia',     'wo-members', 'person', 'Sample Person 464', 'Systems for Production & Prayer Room (Temp)', 'inward', NULL, 'temp', false, 5),
('wo-charina',   'wo-members', 'person', 'Sample Person 423', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 6),
('wo-calebf',    'wo-members', 'person', 'Sample Person 24 Frow', 'Worship & Prayer Circle (Temp)', 'inward', NULL, 'temp', false, 7),
('wo-paulo',     'wo-members', 'person', 'Sample Person 504', 'Evangelism · joined from Woven (June 2026)', 'inward', NULL, NULL, false, 8),
('wo-briana',    'wo-members', 'person', 'Sample Person 412', 'Songwriting team · Worship Leader', 'inward', NULL, NULL, false, 9),
('wo-hendriette','wo-members', 'person', 'Sample Person 445', 'Production team · Prayer Leader Scheduling · Main Slides', 'inward', NULL, NULL, false, 10),
('wo-kay',       'wo-members', 'person', 'Sample Person 467', 'Music Track DTS · Main Systems · Calendar / Stats · Media', 'inward', NULL, NULL, false, 11),
('wo-philip',    'wo-members', 'person', 'Sample Person 505', 'Worship Leader · Ministry Night Scheduling · OKR Manager', 'inward', NULL, NULL, false, 12),
('wo-tharina',   'wo-members', 'person', 'Sample Person 522', 'Prayer Room team · Media team', 'inward', NULL, NULL, false, 13),
('wo-carmella',  'wo-members', 'person', 'Sample Person 416', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 14),
('wo-kristine',  'wo-members', 'person', 'Sample Person 470', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 15),
('wo-malise',    'wo-members', 'person', 'Sample Person 479', 'Worship & Prayer Circle (Temp)', 'inward', NULL, 'temp', false, 16),
('wo-bianca-vdm','wo-members', 'person', 'Sample Person 19 vdm', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 17),
('wo-jan-hendrik','wo-members', 'person', 'Sample Person 454', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 18),
('wo-jolizna-r', 'wo-members', 'person', 'Sample Person 460', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 19),
('wo-jackk',     'wo-members', 'person', 'Sample Person 451', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 20),
('wo-kaymc',     'wo-members', 'person', 'Sample Person 468', 'Worship & Prayer Circle', 'inward', NULL, NULL, false, 21);

-- ════════════════════════════════════════════════════════════
-- BACKBONE · SUPPORT
-- ════════════════════════════════════════════════════════════
INSERT INTO _seed VALUES
('team-ops',     'cluster-backbone', 'team', 'Operations',      'Base · hospitality · kitchens',     'backbone', 17, NULL, true, 0),
('team-finance', 'cluster-backbone', 'team', 'Finances & Legal','Stewardship · compliance',          'backbone', 2,  NULL, false, 1),
('team-donors',  'cluster-backbone', 'team', 'Donors & Dev',    'Corporate fundraising',             'backbone', NULL, NULL, false, 2),
('team-media',   'cluster-backbone', 'team', 'Media',           'Content · comms · marketing',       'backbone', 9,  NULL, true, 3);

-- Operations (17) — Sample Person 492
INSERT INTO _seed VALUES
('ops-init',     'team-ops', 'subteam', 'Initiatives · Buildings', 'Point: Sample Person 492 / Sample Person 443', 'backbone', NULL, NULL, false, 0),
('ops-living',   'team-ops', 'subteam', 'Living & Logistics',      'Hospitality · hosting · systems', 'backbone', NULL, NULL, false, 1),
('ops-kitchens', 'team-ops', 'subteam', 'Base Kitchens',           'Point: Sample Person 286', 'backbone', NULL, NULL, false, 2);
INSERT INTO _seed VALUES
('ops-michelle', 'ops-init', 'person', 'Sample Person 492', 'Operations point leader · Initiatives', 'backbone', NULL, NULL, false, 0),
('ops-hesteyn',  'ops-init', 'person', 'Sample Person 443', 'Buildings · Security · Maintenance point leader', 'backbone', NULL, NULL, false, 1),
('ops-gideon',   'ops-init', 'person', 'Sample Person 440', 'Base vehicles · systems & maintenance', 'backbone', NULL, NULL, false, 2),
('ops-eddie',    'ops-init', 'person', 'Sample Person 503', 'Maintenance crew lead (buildings & spaces)', 'backbone', NULL, NULL, false, 3),
('ops-sample253',    'ops-init', 'person', 'Sample Person 253', 'Maintenance crew', 'backbone', NULL, NULL, false, 4),
('ops-dylan',    'ops-init', 'person', 'Sample Person 45', 'Buildings & maintenance', 'backbone', NULL, NULL, false, 5),
('ops-annie',    'ops-living', 'person', 'Sample Person 407', 'Guests & cleaning supplies', 'backbone', NULL, NULL, false, 0),
('ops-enge',     'ops-living', 'person', 'Sample Person 439', 'Hospitality point leader · FFSA schools & staff rooms', 'backbone', NULL, NULL, false, 1),
('ops-sample286',    'ops-living', 'person', 'Sample Person 286', 'Hosting & kitchens point leader · outreach & events', 'backbone', NULL, NULL, false, 2),
('ops-dj',       'ops-kitchens', 'person', 'Sample Person 435', 'Lemon Blossom kitchen', 'backbone', NULL, NULL, false, 0),
('ops-chane',    'ops-kitchens', 'person', 'Sample Person 421', 'Lemon Blossom kitchen', 'backbone', NULL, NULL, false, 1),
('ops-millie',   'ops-kitchens', 'person', 'Sample Person 493', 'Lemon Blossom kitchen', 'backbone', NULL, NULL, false, 2),
('ops-michael',  'ops-kitchens', 'person', 'Sample Person 490', 'OG Kitchen', 'backbone', NULL, NULL, false, 3),
('ops-kay',      'ops-kitchens', 'person', 'Sample Person 467', 'OG Kitchen', 'backbone', NULL, NULL, false, 4),
('ops-biancav',  'ops-kitchens', 'person', 'Sample Person 19 V', 'OG Kitchen', 'backbone', NULL, NULL, false, 5),
('ops-marne',    'ops-kitchens', 'person', 'Sample Person 481', 'Container Kitchen', 'backbone', NULL, NULL, false, 6),
('ops-matthewg', 'ops-kitchens', 'person', 'Sample Person 484', 'Container Kitchen', 'backbone', NULL, NULL, false, 7);

-- Finances & Legal (2) — Sample Person 2
INSERT INTO _seed VALUES
('fin-sample2', 'team-finance', 'person', 'Sample Person 2', 'Finance Manager & Legal Department Lead', 'backbone', NULL, NULL, false, 0),
('fin-sample50',  'team-finance', 'person', 'Sample Person 50', 'Finance Clerk (under Sample Person 2)', 'backbone', NULL, NULL, false, 1);

-- Donors & Dev — Sample Person 21 (cross-team; primary in Leadership, shown here as lead)
INSERT INTO _seed VALUES
('don-sample21', 'team-donors', 'person', 'Sample Person 21', 'Corporate fundraising lead', 'backbone', NULL, NULL, false, 0);

-- Media (9) — Sample Person 279 + Ghost Team
INSERT INTO _seed VALUES
('me-tosca',    'team-media', 'person', 'Sample Person 279', 'Media Point Leader & Creative Lead', 'backbone', NULL, NULL, false, 0),
('me-nathaly',  'team-media', 'person', 'Sample Person 498', 'Marketing Director & Ministry Leader · Training Systems', 'backbone', NULL, NULL, false, 1),
('me-annika',   'team-media', 'person', 'Sample Person 408', 'Ghost Team point person: content executor', 'backbone', NULL, NULL, false, 2),
('me-ilne',     'team-media', 'person', 'Sample Person 448', 'Ghost Team support · photography · future Ghost Team lead', 'backbone', NULL, NULL, false, 3),
('me-sample280',   'team-media', 'person', 'Sample Person 280', 'Videographer', 'backbone', NULL, NULL, false, 4),
('me-colton',   'team-media', 'person', 'Sample Person 425', 'Videographer', 'backbone', NULL, NULL, false, 5),
('me-annwaniq', 'team-media', 'person', 'Sample Person 405', 'Ministry Nights content · photography & editing trainee', 'backbone', NULL, NULL, false, 6),
('me-gitte',    'team-media', 'person', 'Sample Person 441', 'Volunteer photographer (not FFSA staff)', 'backbone', NULL, NULL, false, 7),
('me-nina',     'team-media', 'person', 'Sample Person 500', 'Merch · on sabbatical; future role under review', 'backbone', NULL, 'temp', false, 8);

-- ════════════════════════════════════════════════════════════
-- ALONGSIDE STRUCTURE — Missio Church (parallel, dotted)
-- ════════════════════════════════════════════════════════════
INSERT INTO _seed VALUES
('missio',        NULL,      'stream', 'Missio Church',         'Sodality & modality · two expressions of one body', 'sand', NULL, NULL, false, 99),
('missio-leaders','missio',  'stream', 'Missio Leadership',     'Sample Person 244 (Senior) · Sample Person 240 (Frontiers Church Planting)', 'sand', NULL, NULL, false, 0),
('missio-comm',   'missio-leaders', 'stream', 'Missional Communities', NULL, 'sand', NULL, NULL, false, 0),
('missio-groups', 'missio-comm', 'stream', 'Small Groups',      '6+ active', 'sand', NULL, NULL, false, 0),
('missio-disc',   'missio-groups', 'stream', 'Individual Disciples', NULL, 'sand', NULL, NULL, false, 0);

-- ── Cross-team service & parallel connectors (dotted) ───────
INSERT INTO _seed_edges VALUES
('p-sample244',  'missio',         'parallel',   'alongside'),
('p-sample240',   'missio',         'parallel',   'church planting'),
('p-sample244',  'team-events',    'cross_team', 'mobilises'),
('p-sample240',   'team-p54',       'cross_team', 'Project 54'),
('p-sample246',    'team-p54',       'cross_team', 'Project 54'),
('p-sample21',  'team-events',    'cross_team', 'finance'),
('p-sample21',  'team-finance',   'cross_team', 'finance'),
('p-sample21',  'team-donors',    'cross_team', 'fundraising'),
('p-ally',     'team-training',  'cross_team', 'FFX coach'),
('p-ally',     'team-inside',    'cross_team', 'Inside Ministry'),
('p-michelle', 'team-ops',       'cross_team', 'Operations'),
('p-sample248',     'team-training',  'cross_team', 'Training Director'),
('p-caleb',    'team-outside',   'cross_team', 'Outside Ministry'),
('p54-mercy',  'tr-core',        'cross_team', 'short-form coach'),
('p54-veronica','team-p54',      'cross_team', 'Training point'),
('me-tosca',   'team-events',    'cross_team', 'Events media'),
('me-nathaly', 'tr-core',        'cross_team', 'Training systems'),
('ops-sample286',  'team-events',    'cross_team', 'hosting'),
('h-sample244b','team-events',    'cross_team', 'mobilisation'),
('w-steph',    'team-finance',   'cross_team', 'finance'),
('p54-josiah', 'team-worship',   'cross_team', 'Prayer & Worship');

-- ── Resolve the staging tables into real rows ───────────────
INSERT INTO public.org_nodes
  (chart_id, key, kind, label, subtitle, accent, headcount, status, collapsed, sort_order)
SELECT v_chart, key, kind, label, subtitle, accent, headcount, status,
       COALESCE(collapsed, false), sort_order
FROM _seed;

UPDATE public.org_nodes n
SET parent_id = p.id
FROM _seed s
JOIN public.org_nodes p ON p.key = s.parent_key AND p.chart_id = v_chart
WHERE n.key = s.key AND n.chart_id = v_chart AND s.parent_key IS NOT NULL;

INSERT INTO public.org_edges (chart_id, source_id, target_id, kind, label)
SELECT v_chart, src.id, tgt.id, e.kind, e.label
FROM _seed_edges e
JOIN public.org_nodes src ON src.key = e.source_key AND src.chart_id = v_chart
JOIN public.org_nodes tgt ON tgt.key = e.target_key AND tgt.chart_id = v_chart;

END $$;

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   SELECT kind, count(*) FROM public.org_nodes
--     WHERE chart_id = (SELECT id FROM public.org_charts WHERE slug='ffsa-2026')
--     GROUP BY kind ORDER BY kind;
--   -- expect ~157 person rows + clusters/teams/subteams/stream
--   SELECT count(*) FROM public.org_edges
--     WHERE chart_id = (SELECT id FROM public.org_charts WHERE slug='ffsa-2026');
--   SELECT key, display_name FROM public.permissions WHERE module = 'org-chart';
-- ============================================================
