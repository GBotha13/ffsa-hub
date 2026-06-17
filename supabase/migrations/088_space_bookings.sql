-- ============================================================
-- FFSA Hub — Migration 088: Space Bookings module
-- ============================================================
-- Replaces the "FFSA VENUE | BOOKINGS" Google Sheet with a real
-- module. Each spreadsheet tab becomes a venue; each row becomes a
-- booking request that moves through pending → approved / denied.
--
-- New tables:
--   ministries      — lookup for the MINISTRY column (HULC, Brave Love, …)
--   venues          — the bookable spaces (was: spreadsheet tabs)
--   booking_series  — a recurring-weekly definition
--   venue_bookings  — one row per booking / per generated occurrence
--
-- Permissions (module = 'bookings'):
--   bookings.view     — see venues + bookings
--   bookings.request  — create booking requests
--   bookings.approve  — approve / deny requests
--   bookings.manage   — manage venues & ministries
--
-- Access model (per the locked v1 scope):
--   - Anyone holding ANY bookings.* permission can VIEW.
--   - Approval is permission-based (bookings.approve), no single owner.
--   - is_admin() and has_permission() helpers already exist (002 / 015).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Shared access helper — true if the user can see the module
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_bookings_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_permission('bookings.view')
      OR public.has_permission('bookings.request')
      OR public.has_permission('bookings.approve')
      OR public.has_permission('bookings.manage');
$$;

-- ────────────────────────────────────────────────────────────
-- 1. MINISTRIES (lookup)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.ministries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  color       text NOT NULL DEFAULT '#6366f1',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. VENUES (the bookable spaces)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.venues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  building    text,
  description text,
  capacity    integer,
  color       text NOT NULL DEFAULT '#0ea5e9',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES public.users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. BOOKING SERIES (recurring-weekly definition)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.booking_series (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  ministry_id  uuid REFERENCES public.ministries (id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  point_person text,
  -- 0 = Sunday … 6 = Saturday (matches Postgres EXTRACT(DOW) and JS getDay())
  weekday      smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time   time,
  end_time     time,
  setup_time   time,
  setdown_time time,
  series_start date NOT NULL,
  series_end   date NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  created_by   uuid REFERENCES public.users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 4. VENUE BOOKINGS (one row per booking / per occurrence)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.venue_bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  ministry_id   uuid REFERENCES public.ministries (id) ON DELETE SET NULL,
  series_id     uuid REFERENCES public.booking_series (id) ON DELETE CASCADE,
  title         text NOT NULL,                 -- EVENT NAME
  description   text,                          -- EVENT DESCRIPTION
  point_person  text,                          -- POINT PERSON (free text in v1)
  booking_date  date NOT NULL,                 -- first / only day
  end_date      date,                          -- multi-day span (null = single day)
  start_time    time,                          -- EVENT TIME (start)
  end_time      time,                          -- EVENT TIME (end)
  setup_time    time,                          -- SET-UP TIME
  setdown_time  time,                          -- SET-DOWN TIME
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  decision_note text,
  requested_by  uuid REFERENCES public.users (id),
  requester_name text,                         -- NAME column (display)
  decided_by    uuid REFERENCES public.users (id),
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_bookings_end_after_start
    CHECK (end_date IS NULL OR end_date >= booking_date)
);

-- ────────────────────────────────────────────────────────────
-- 5. INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_venue_bookings_venue_date ON public.venue_bookings (venue_id, booking_date);
CREATE INDEX idx_venue_bookings_date       ON public.venue_bookings (booking_date);
CREATE INDEX idx_venue_bookings_status     ON public.venue_bookings (status);
CREATE INDEX idx_venue_bookings_series     ON public.venue_bookings (series_id);
CREATE INDEX idx_booking_series_venue      ON public.booking_series (venue_id);

-- ────────────────────────────────────────────────────────────
-- 6. PERMISSIONS (master list)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (module, key, display_name, sort_order) VALUES
  ('bookings', 'bookings.view',    'View Bookings',           10),
  ('bookings', 'bookings.request', 'Request Bookings',        20),
  ('bookings', 'bookings.approve', 'Approve / Deny Bookings', 30),
  ('bookings', 'bookings.manage',  'Manage Venues & Settings', 40)
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.ministries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_bookings ENABLE ROW LEVEL SECURITY;

-- ── ministries ─────────────────────────────────────────────
CREATE POLICY "ministries_read" ON public.ministries
  FOR SELECT TO authenticated
  USING (public.has_bookings_access());

CREATE POLICY "ministries_manage" ON public.ministries
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('bookings.manage'))
  WITH CHECK (public.is_admin() OR public.has_permission('bookings.manage'));

-- ── venues ─────────────────────────────────────────────────
CREATE POLICY "venues_read" ON public.venues
  FOR SELECT TO authenticated
  USING (public.has_bookings_access());

CREATE POLICY "venues_manage" ON public.venues
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('bookings.manage'))
  WITH CHECK (public.is_admin() OR public.has_permission('bookings.manage'));

-- ── booking_series ─────────────────────────────────────────
CREATE POLICY "booking_series_read" ON public.booking_series
  FOR SELECT TO authenticated
  USING (public.has_bookings_access());

CREATE POLICY "booking_series_insert" ON public.booking_series
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('bookings.request')
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
  );

CREATE POLICY "booking_series_update" ON public.booking_series
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR created_by = auth.uid()
  );

CREATE POLICY "booking_series_delete" ON public.booking_series
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.manage')
    OR created_by = auth.uid()
  );

-- ── venue_bookings ─────────────────────────────────────────
CREATE POLICY "venue_bookings_read" ON public.venue_bookings
  FOR SELECT TO authenticated
  USING (public.has_bookings_access());

CREATE POLICY "venue_bookings_insert" ON public.venue_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('bookings.request')
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
  );

-- Requesters can edit / cancel their own; approvers & managers can edit any.
CREATE POLICY "venue_bookings_update" ON public.venue_bookings
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR requested_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('bookings.approve')
    OR public.has_permission('bookings.manage')
    OR requested_by = auth.uid()
  );

CREATE POLICY "venue_bookings_delete" ON public.venue_bookings
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('bookings.manage')
    OR requested_by = auth.uid()
  );

-- ────────────────────────────────────────────────────────────
-- 8. SEED DATA (from the existing spreadsheet)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.ministries (name, slug, color, sort_order) VALUES
  ('HULC',            'hulc',            '#a78bfa', 10),
  ('Brave Love',      'brave-love',      '#ec4899', 20),
  ('Worship & Prayer','worship-prayer',  '#22c55e', 30)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.venues (name, slug, building, color, sort_order) VALUES
  ('Auditorium',                  'auditorium',     'FFSA Building', '#0ea5e9', 10),
  ('Molen St (Old Prayer Room)',  'molen-st',       'Molen St',      '#8b5cf6', 20),
  ('Upstairs Space',              'upstairs-space', 'FFSA Building', '#f59e0b', 30),
  ('FFSA Training Venue',         'ffsa-training',  'FFSA Training', '#10b981', 40)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Validation (run in the Supabase SQL Editor after applying)
-- ------------------------------------------------------------
--   SELECT key, display_name FROM public.permissions WHERE module = 'bookings';
--   SELECT name, slug, building FROM public.venues ORDER BY sort_order;
--   SELECT name, slug FROM public.ministries ORDER BY sort_order;
--   SELECT tablename, policyname, cmd FROM pg_policies
--     WHERE tablename IN ('venues','ministries','venue_bookings','booking_series')
--     ORDER BY tablename, cmd;
-- ============================================================
