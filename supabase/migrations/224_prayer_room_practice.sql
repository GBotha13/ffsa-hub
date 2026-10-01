-- ============================================================
-- FFSA Hub — Migration 224: prayer room PRACTICE
-- ============================================================
-- Handoff 17 / design turn 36 (36a–36e). Afternoon practice in the room:
--
--   · 16:00–17:30 on Mon, Wed, Thu, Fri, in 30-minute rows. Tuesday is closed
--     for ministry night.
--   · Seven stations, one person each, everyone in a row practising at once on
--     their own ME mix. Vocals is ONE booking: solo, or a group of up to four.
--   · A full band takes the whole room, and only on an empty row. Only an admin
--     can move people out to make room, with a reason, and every move is
--     recorded with a message written for the person who lost the time.
--   · Bookings open every Sunday 00:00 SAST for the Mon–Fri that follows. 60
--     minutes at most. No weekly caps, no cut-off, no no-show flags.
--
-- EXTENDS, does not replace. Nothing existing is renamed or dropped:
--   · Stations point at prayer_room_seat_types (migration 181), so "your
--     instrument from your profile" is the seat you are signed off for in
--     prayer_room_qualifications.
--   · Who may book reuses is_prayer_room_member(); who may move people reuses
--     is_prayer_room_staff() (both migration 084).
--
-- PRACTICE IS NOT COVERAGE. It lives in its own tables and never creates a
-- prayer_room_sets row, so nothing that counts sets, seats or minutes
-- (prayer_room_open_slots, the wall, person KPIs, the dashboard card) can see
-- it. Keep it that way: do not instantiate practice as sets.
--
-- Every rule below is enforced HERE — exclusion constraints for the clashes,
-- a trigger for the window/step/length/opening rules, and SECURITY DEFINER
-- functions for the multi-row writes — so the UI cannot be the only guard.
--
-- Also moves the curated NIGHT band from 17:00–19:00 to 17:30–20:00 (§7).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ────────────────────────────────────────────────────────────
-- 1. SETTINGS (singleton)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_settings (
  id              boolean PRIMARY KEY DEFAULT true CHECK (id),
  start_time      time     NOT NULL DEFAULT '16:00',
  end_time        time     NOT NULL DEFAULT '17:30',
  slot_minutes    integer  NOT NULL DEFAULT 30,
  -- 0 = Sunday … 6 = Saturday. Weekends are never open (the wall is Mon–Fri);
  -- these are the WEEKDAYS that are also closed.
  closed_weekdays smallint[] NOT NULL DEFAULT '{2}',
  -- What the wall prints across a closed day. Empty on the wall means free,
  -- so a closed window is never left blank.
  closed_label    text     NOT NULL DEFAULT 'Ministry night',
  max_minutes     integer  NOT NULL DEFAULT 60,
  -- Bookings for a Mon–Fri open on this weekday at this time, SAST. 0 = the
  -- Sunday that begins the week; 6 = the Saturday before it, and so on.
  opens_weekday   smallint NOT NULL DEFAULT 0 CHECK (opens_weekday BETWEEN 0 AND 6),
  opens_time      time     NOT NULL DEFAULT '00:00',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.users(id),
  CONSTRAINT practice_window_order CHECK (end_time > start_time),
  CONSTRAINT practice_slot_size    CHECK (slot_minutes BETWEEN 5 AND 120),
  CONSTRAINT practice_max_length   CHECK (max_minutes >= slot_minutes AND max_minutes % slot_minutes = 0)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.practice_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.practice_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.practice_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. STATIONS — a table, not an enum, so a new one needs no migration
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_stations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  label        text NOT NULL,
  -- The two letters on the wall's squares: DR KY EL CJ AC BS VX.
  short_label  text NOT NULL,
  -- The seat this station practises. Drives the default pick in the drawer.
  seat_type_id text REFERENCES public.prayer_room_seat_types(id) ON DELETE SET NULL,
  sort_order   smallint NOT NULL DEFAULT 0,
  -- People inside ONE booking of this station. 1 everywhere except vocals.
  max_people   smallint NOT NULL DEFAULT 1 CHECK (max_people BETWEEN 1 AND 12),
  is_active    boolean  NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Seat ids are looked up rather than hard-wired, so this runs on a database
-- where a seat is missing (the station just has no default instrument).
INSERT INTO public.practice_stations (slug, label, short_label, seat_type_id, sort_order, max_people)
SELECT v.slug, v.label, v.short_label,
       (SELECT st.id FROM public.prayer_room_seat_types st WHERE st.id = v.seat),
       v.sort_order, v.max_people
  FROM (VALUES
    ('drums',    'Drums',    'DR', 'drums',           1, 1),
    ('keys',     'Keys',     'KY', 'keys',            2, 1),
    ('electric', 'Electric', 'EL', 'electric_guitar', 3, 1),
    ('cajon',    'Cajon',    'CJ', 'cajon',           4, 1),
    ('acoustic', 'Acoustic', 'AC', 'acoustic',        5, 1),
    ('bass',     'Bass',     'BS', 'bass_guitar',     6, 1),
    ('vocals',   'Vocals',   'VX', 'vocals',          7, 4)
  ) AS v(slug, label, short_label, seat, sort_order, max_people)
ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. BOOKINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL CHECK (kind IN ('station', 'band')),
  practice_date       date NOT NULL,
  start_time          time NOT NULL,
  end_time            time NOT NULL,
  station_id          uuid REFERENCES public.practice_stations(id),
  booked_by           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_name           text,
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'cancelled', 'moved')),
  -- When an admin moves someone, the half-hour they keep becomes a new row
  -- that points back at the booking it came from.
  replaces_booking_id uuid REFERENCES public.practice_bookings(id) ON DELETE SET NULL,
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.users(id),
  -- Local wall-clock range. Every practice row is SAST and SAST has no DST,
  -- so a plain timestamp range compares correctly.
  slot                tsrange GENERATED ALWAYS AS
                      (tsrange(practice_date + start_time, practice_date + end_time, '[)')) STORED,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT practice_end_after_start CHECK (end_time > start_time),
  CONSTRAINT practice_kind_shape CHECK (
    (kind = 'station' AND station_id IS NOT NULL AND band_name IS NULL)
    OR (kind = 'band' AND station_id IS NULL AND band_name IS NOT NULL AND length(btrim(band_name)) > 0)
  ),
  -- One booking per station per moment.
  CONSTRAINT practice_station_no_overlap
    EXCLUDE USING gist (station_id WITH =, slot WITH &&)
    WHERE (status = 'active' AND kind = 'station'),
  -- One band per moment.
  CONSTRAINT practice_band_no_overlap
    EXCLUDE USING gist (slot WITH &&)
    WHERE (status = 'active' AND kind = 'band'),
  -- A band and a station never share a moment, whichever arrives first.
  CONSTRAINT practice_band_vs_station
    EXCLUDE USING gist (kind WITH <>, slot WITH &&)
    WHERE (status = 'active')
);

CREATE INDEX IF NOT EXISTS idx_practice_bookings_date
  ON public.practice_bookings (practice_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_practice_bookings_booker
  ON public.practice_bookings (booked_by);

DROP TRIGGER IF EXISTS set_updated_at ON public.practice_bookings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.practice_bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Who is in a booking: the one person on a station, the singers in a vocal
-- group, or who is on which instrument in a band. Names on the wall read from
-- here, so a solo booking lists its booker too.
CREATE TABLE IF NOT EXISTS public.practice_booking_people (
  booking_id uuid NOT NULL REFERENCES public.practice_bookings(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.practice_stations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_people_user ON public.practice_booking_people (user_id);

-- The audit of every admin move: one row per person who lost time, carrying
-- the exact message they were sent.
CREATE TABLE IF NOT EXISTS public.practice_moves (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           uuid NOT NULL REFERENCES public.practice_bookings(id) ON DELETE CASCADE,
  band_booking_id      uuid REFERENCES public.practice_bookings(id) ON DELETE SET NULL,
  remainder_booking_id uuid REFERENCES public.practice_bookings(id) ON DELETE SET NULL,
  affected_user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  moved_by             uuid NOT NULL REFERENCES public.users(id),
  reason               text NOT NULL CHECK (length(btrim(reason)) > 0),
  message              text NOT NULL,
  lost_start           time NOT NULL,
  lost_end             time NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_moves_user ON public.practice_moves (affected_user_id);

-- ────────────────────────────────────────────────────────────
-- 4. THE RULES (trigger)
-- ────────────────────────────────────────────────────────────
-- Raised messages are written for the person booking — the routes pass them
-- straight through.

/** When bookings for the week containing `d` open, as SAST wall-clock time. */
CREATE OR REPLACE FUNCTION public.practice_opens_at(d date)
RETURNS timestamp LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (d - extract(dow FROM d)::int                      -- that week's Sunday
            - ((7 - s.opens_weekday) % 7))                  -- back to the opening day
         + s.opens_time
    FROM public.practice_settings s
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.practice_now()
RETURNS timestamp LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Africa/Johannesburg');
$$;

CREATE OR REPLACE FUNCTION public.practice_validate_booking()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  s          public.practice_settings%ROWTYPE;
  dow        int;
  win_start  int;
  m_start    int;
  m_end      int;
  span_start time;
  span_end   time;
  st_active  boolean;
BEGIN
  -- Only an active booking has to obey the rules. Cancelling or moving one
  -- is always allowed.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.practice_date = OLD.practice_date
     AND NEW.start_time = OLD.start_time
     AND NEW.end_time = OLD.end_time
     AND NEW.kind = OLD.kind
     AND NEW.station_id IS NOT DISTINCT FROM OLD.station_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM public.practice_settings LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Practice is not set up yet.' USING ERRCODE = 'check_violation';
  END IF;

  dow := extract(dow FROM NEW.practice_date)::int;
  IF dow IN (0, 6) OR dow = ANY (s.closed_weekdays) THEN
    RAISE EXCEPTION 'There is no practice on %s.', to_char(NEW.practice_date, 'FMDay')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.start_time < s.start_time OR NEW.end_time > s.end_time THEN
    RAISE EXCEPTION 'Practice runs % to %.', to_char(s.start_time, 'HH24:MI'), to_char(s.end_time, 'HH24:MI')
      USING ERRCODE = 'check_violation';
  END IF;

  win_start := extract(epoch FROM s.start_time)::int / 60;
  m_start   := extract(epoch FROM NEW.start_time)::int / 60;
  m_end     := extract(epoch FROM NEW.end_time)::int / 60;
  IF (m_start - win_start) % s.slot_minutes <> 0 OR (m_end - win_start) % s.slot_minutes <> 0
     OR extract(second FROM NEW.start_time) <> 0 OR extract(second FROM NEW.end_time) <> 0 THEN
    RAISE EXCEPTION 'Practice is booked in %-minute rows.', s.slot_minutes
      USING ERRCODE = 'check_violation';
  END IF;

  IF m_end - m_start > s.max_minutes THEN
    RAISE EXCEPTION 'A booking can be % minutes at most.', s.max_minutes
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.kind = 'station' THEN
    SELECT is_active INTO st_active FROM public.practice_stations WHERE id = NEW.station_id;
    IF NOT coalesce(st_active, false) THEN
      RAISE EXCEPTION 'That station is not available.' USING ERRCODE = 'check_violation';
    END IF;

    -- 60 minutes means the same station in adjoining rows, however it was
    -- booked: two touching 30s by the same person count as one stretch.
    -- With a 30-minute step and a 60-minute cap a stretch is never more than
    -- two rows, so the direct neighbours are all there is to find.
    SELECT least(NEW.start_time, min(b.start_time)), greatest(NEW.end_time, max(b.end_time))
      INTO span_start, span_end
      FROM public.practice_bookings b
     WHERE b.status = 'active'
       AND b.kind = 'station'
       AND b.station_id = NEW.station_id
       AND b.booked_by = NEW.booked_by
       AND b.practice_date = NEW.practice_date
       AND b.id <> NEW.id
       AND b.start_time <= NEW.end_time
       AND b.end_time >= NEW.start_time;
    IF (extract(epoch FROM span_end) - extract(epoch FROM span_start)) / 60 > s.max_minutes THEN
      RAISE EXCEPTION 'That would be more than % minutes on the same station in a row.', s.max_minutes
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- The opening and the past only bind NEW bookings. The half-hour an admin
  -- leaves someone after a move is a continuation, not a new booking.
  IF NEW.replaces_booking_id IS NULL THEN
    IF NEW.practice_date + NEW.end_time <= public.practice_now() THEN
      RAISE EXCEPTION 'That time has already gone.' USING ERRCODE = 'check_violation';
    END IF;
    IF public.practice_now() < public.practice_opens_at(NEW.practice_date) THEN
      RAISE EXCEPTION 'Bookings for that week open %.',
        to_char(public.practice_opens_at(NEW.practice_date), 'FMDy DD Mon "at" HH24:MI')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_practice_validate ON public.practice_bookings;
CREATE TRIGGER trg_practice_validate
  BEFORE INSERT OR UPDATE ON public.practice_bookings
  FOR EACH ROW EXECUTE FUNCTION public.practice_validate_booking();

-- People: capacity per booking, the right station, and nobody in two places.
CREATE OR REPLACE FUNCTION public.practice_validate_person()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  b        public.practice_bookings%ROWTYPE;
  cap      smallint;
  used     int;
  clash    text;
BEGIN
  SELECT * INTO b FROM public.practice_bookings WHERE id = NEW.booking_id;

  IF b.kind = 'station' THEN
    -- On a station booking everyone is on that station.
    NEW.station_id := b.station_id;
  END IF;

  SELECT max_people INTO cap FROM public.practice_stations WHERE id = NEW.station_id;
  SELECT count(*) INTO used
    FROM public.practice_booking_people p
   WHERE p.booking_id = NEW.booking_id
     AND p.station_id = NEW.station_id
     AND p.user_id <> NEW.user_id;
  IF used + 1 > coalesce(cap, 1) THEN
    RAISE EXCEPTION 'That station holds % at most.', coalesce(cap, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  IF b.status = 'active' THEN
    SELECT coalesce(u.first_name, 'Someone') INTO clash
      FROM public.practice_booking_people p
      JOIN public.practice_bookings o ON o.id = p.booking_id
      JOIN public.users u ON u.id = p.user_id
     WHERE p.user_id = NEW.user_id
       AND o.id <> b.id
       AND o.status = 'active'
       AND o.slot && b.slot
     LIMIT 1;
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION '% is already practising then.', clash USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_practice_person ON public.practice_booking_people;
CREATE TRIGGER trg_practice_person
  BEFORE INSERT OR UPDATE ON public.practice_booking_people
  FOR EACH ROW EXECUTE FUNCTION public.practice_validate_person();

-- ────────────────────────────────────────────────────────────
-- 5. WRITES (RPCs) — the only way members change practice
-- ────────────────────────────────────────────────────────────
-- SECURITY DEFINER so a booking and its people land together or not at all.
-- Each one re-checks who is calling; the constraints and triggers above still
-- run on every row they write.

CREATE OR REPLACE FUNCTION public.practice_can_book()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_prayer_room_member() OR public.is_prayer_room_staff();
$$;

/** Raise unless every id is an active prayer room member. */
CREATE OR REPLACE FUNCTION public.practice_assert_members(ids uuid[])
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing
    FROM unnest(coalesce(ids, '{}')) AS x(id)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.prayer_room_members m WHERE m.user_id = x.id AND m.status = 'active'
   );
  IF missing > 0 THEN
    RAISE EXCEPTION 'Everyone you add has to be in the prayer room.' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

/**
 * Book a station. `p_singers` is only for vocals: the other people in the
 * group, not counting you. Solo is an empty list.
 */
CREATE OR REPLACE FUNCTION public.practice_book_station(
  p_date date, p_start time, p_end time, p_station uuid, p_singers uuid[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me      uuid := auth.uid();
  new_id  uuid;
  cap     smallint;
  others  uuid[];
BEGIN
  IF me IS NULL OR NOT public.practice_can_book() THEN
    RAISE EXCEPTION 'Only people in the prayer room can book practice.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT max_people INTO cap FROM public.practice_stations WHERE id = p_station;
  others := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_singers, '{}')) AS x WHERE x <> me);
  IF coalesce(array_length(others, 1), 0) > 0 AND coalesce(cap, 1) <= 1 THEN
    RAISE EXCEPTION 'Only vocals can be booked as a group.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM public.practice_assert_members(others);

  INSERT INTO public.practice_bookings (kind, practice_date, start_time, end_time, station_id, booked_by)
  VALUES ('station', p_date, p_start, p_end, p_station, me)
  RETURNING id INTO new_id;

  INSERT INTO public.practice_booking_people (booking_id, user_id, station_id)
  SELECT new_id, u, p_station FROM unnest(array_prepend(me, others)) AS u;

  RETURN new_id;
END;
$$;

/**
 * Book the whole room. `p_lineup` is [{ "station_id": uuid, "user_id": uuid }].
 * Only an empty row: the exclusion constraints refuse anything else.
 */
CREATE OR REPLACE FUNCTION public.practice_book_band(
  p_date date, p_start time, p_end time, p_band_name text, p_lineup jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me     uuid := auth.uid();
  new_id uuid;
  ids    uuid[];
BEGIN
  IF me IS NULL OR NOT public.practice_can_book() THEN
    RAISE EXCEPTION 'Only people in the prayer room can book practice.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  ids := ARRAY(SELECT (e->>'user_id')::uuid FROM jsonb_array_elements(coalesce(p_lineup, '[]')) e);
  PERFORM public.practice_assert_members(ids);

  INSERT INTO public.practice_bookings (kind, practice_date, start_time, end_time, booked_by, band_name)
  VALUES ('band', p_date, p_start, p_end, me, btrim(p_band_name))
  RETURNING id INTO new_id;

  INSERT INTO public.practice_booking_people (booking_id, user_id, station_id)
  SELECT new_id, (e->>'user_id')::uuid, (e->>'station_id')::uuid
    FROM jsonb_array_elements(coalesce(p_lineup, '[]')) e;

  RETURN new_id;
END;
$$;

/** Cancel your own booking. Staff can cancel anyone's. */
CREATE OR REPLACE FUNCTION public.practice_cancel(p_booking uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  UPDATE public.practice_bookings
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = me
   WHERE id = p_booking
     AND status = 'active'
     AND (booked_by = me OR public.is_prayer_room_staff());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only cancel your own booking.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ── Moving people for a band (admins only) ──────────────────

/** "16:30" or "16:30–17:30". */
CREATE OR REPLACE FUNCTION public.practice_hhmm(t time)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT to_char(t, 'HH24:MI') $$;

/**
 * Who loses what if a band takes p_start–p_end on p_date, and the message
 * each of them will get. Read-only: this is 36d's preview, and
 * practice_move_and_book_band() writes exactly these messages.
 */
CREATE OR REPLACE FUNCTION public.practice_move_plan(
  p_date date, p_start time, p_end time, p_reason text
) RETURNS TABLE (
  booking_id   uuid,
  user_id      uuid,
  person_name  text,
  station      text,
  booked_start time,
  booked_end   time,
  lost_start   time,
  lost_end     time,
  kept         text,
  message      text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_name text;
  why        text := btrim(coalesce(p_reason, ''));
BEGIN
  IF NOT public.is_prayer_room_staff() THEN
    RAISE EXCEPTION 'Only an admin can move people.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
    INTO admin_name FROM public.users u WHERE u.id = auth.uid();

  -- "Last full run before Friday NIGHT." reads as "…rehearsal: last full run
  -- before Friday NIGHT." inside the sentence.
  why := regexp_replace(why, '[.\s]+$', '');
  IF why <> '' THEN
    why := lower(left(why, 1)) || substr(why, 2);
  END IF;

  RETURN QUERY
  WITH hit AS (
    SELECT b.id, b.start_time AS bs, b.end_time AS be, st.label AS st_label,
           greatest(b.start_time, p_start) AS ls,
           least(b.end_time, p_end)        AS le
      FROM public.practice_bookings b
      JOIN public.practice_stations st ON st.id = b.station_id
     WHERE b.status = 'active'
       AND b.kind = 'station'
       AND b.practice_date = p_date
       AND b.start_time < p_end
       AND b.end_time > p_start
  ), keep AS (
    SELECT h.*,
           -- What survives on either side of the band (with a 60-minute cap,
           -- at most one side ever does).
           CASE
             WHEN h.bs < h.ls AND h.le < h.be THEN
               public.practice_hhmm(h.bs) || '–' || public.practice_hhmm(h.ls) || ' and ' ||
               public.practice_hhmm(h.le) || '–' || public.practice_hhmm(h.be)
             WHEN h.bs < h.ls THEN public.practice_hhmm(h.bs) || '–' || public.practice_hhmm(h.ls)
             WHEN h.le < h.be THEN public.practice_hhmm(h.le) || '–' || public.practice_hhmm(h.be)
           END AS kept_text,
           CASE
             WHEN h.bs < h.ls OR h.le < h.be THEN public.practice_hhmm(h.ls)
             ELSE public.practice_hhmm(h.bs) || '–' || public.practice_hhmm(h.be)
           END AS lost_text
      FROM hit h
  )
  SELECT k.id,
         p.user_id,
         btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
         k.st_label,
         k.bs, k.be, k.ls, k.le,
         k.kept_text,
         format('Your %s %s practice on %s was moved for a full band rehearsal%s.%s — %s',
                k.lost_text,
                lower(k.st_label),
                to_char(p_date, 'FMDay'),
                CASE WHEN why <> '' THEN ': ' || why ELSE '' END,
                CASE WHEN k.kept_text IS NOT NULL THEN ' You still have ' || k.kept_text || '.' ELSE '' END,
                coalesce(nullif(admin_name, ''), 'Prayer room admin'))
    FROM keep k
    JOIN public.practice_booking_people p ON p.booking_id = k.id
    JOIN public.users u ON u.id = p.user_id
   ORDER BY k.bs, k.st_label, u.first_name;
END;
$$;

/**
 * 36d's MOVE THEM AND BOOK THE BAND. Admins only, reason required. Moves every
 * station booking in the way (keeping whatever half-hour lies outside the
 * band), records one move per person with their message, then books the band.
 * All or nothing.
 */
CREATE OR REPLACE FUNCTION public.practice_move_and_book_band(
  p_date date, p_start time, p_end time, p_band_name text, p_lineup jsonb, p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me       uuid := auth.uid();
  plan     jsonb;
  b        public.practice_bookings%ROWTYPE;
  band_id  uuid;
  rem_id   uuid;
  rem_ids  jsonb := '{}'::jsonb;   -- original booking id → remainder id
BEGIN
  IF me IS NULL OR NOT public.is_prayer_room_staff() THEN
    RAISE EXCEPTION 'Only an admin can move people.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Give a reason. Everyone you move is told it.' USING ERRCODE = 'check_violation';
  END IF;

  -- Read the plan BEFORE changing anything; it is the same text the admin saw.
  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO plan
    FROM public.practice_move_plan(p_date, p_start, p_end, p_reason) x;

  -- 1. Retire each booking in the way and give back what lies outside the band.
  FOR b IN
    SELECT * FROM public.practice_bookings
     WHERE id IN (SELECT DISTINCT (e->>'booking_id')::uuid FROM jsonb_array_elements(plan) e)
     FOR UPDATE
  LOOP
    UPDATE public.practice_bookings SET status = 'moved' WHERE id = b.id;

    rem_id := NULL;
    IF b.start_time < p_start THEN
      INSERT INTO public.practice_bookings
        (kind, practice_date, start_time, end_time, station_id, booked_by, replaces_booking_id)
      VALUES ('station', b.practice_date, b.start_time, p_start, b.station_id, b.booked_by, b.id)
      RETURNING id INTO rem_id;
      INSERT INTO public.practice_booking_people (booking_id, user_id, station_id)
        SELECT rem_id, p.user_id, p.station_id FROM public.practice_booking_people p WHERE p.booking_id = b.id;
    END IF;
    IF b.end_time > p_end THEN
      INSERT INTO public.practice_bookings
        (kind, practice_date, start_time, end_time, station_id, booked_by, replaces_booking_id)
      VALUES ('station', b.practice_date, p_end, b.end_time, b.station_id, b.booked_by, b.id)
      RETURNING id INTO rem_id;
      INSERT INTO public.practice_booking_people (booking_id, user_id, station_id)
        SELECT rem_id, p.user_id, p.station_id FROM public.practice_booking_people p WHERE p.booking_id = b.id;
    END IF;
    IF rem_id IS NOT NULL THEN
      rem_ids := rem_ids || jsonb_build_object(b.id::text, rem_id);
    END IF;
  END LOOP;

  -- 2. The band. Another BAND in the way is not something this moves; the
  --    exclusion constraint refuses it.
  band_id := public.practice_book_band(p_date, p_start, p_end, p_band_name, p_lineup);

  -- 3. The record, one row per person, with the message they get.
  INSERT INTO public.practice_moves
    (booking_id, band_booking_id, remainder_booking_id, affected_user_id, moved_by,
     reason, message, lost_start, lost_end)
  SELECT (e->>'booking_id')::uuid, band_id, (rem_ids->>(e->>'booking_id'))::uuid,
         (e->>'user_id')::uuid, me, btrim(p_reason), e->>'message',
         (e->>'lost_start')::time, (e->>'lost_end')::time
    FROM jsonb_array_elements(plan) e;

  RETURN band_id;
END;
$$;

REVOKE ALL ON FUNCTION public.practice_book_station(date, time, time, uuid, uuid[])                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.practice_book_band(date, time, time, text, jsonb)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.practice_cancel(uuid)                                                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.practice_move_plan(date, time, time, text)                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.practice_move_and_book_band(date, time, time, text, jsonb, text)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.practice_book_station(date, time, time, uuid, uuid[])              TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_book_band(date, time, time, text, jsonb)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_cancel(uuid)                                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_move_plan(date, time, time, text)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_move_and_book_band(date, time, time, text, jsonb, text)   TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
-- Names are on the wall for everyone, so bookings and people read to every
-- signed-in user. Members write only through the functions above; staff may
-- correct rows directly, and the triggers still apply when they do.
ALTER TABLE public.practice_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_stations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_booking_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_moves          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read practice settings"  ON public.practice_settings;
DROP POLICY IF EXISTS "Staff manage practice settings" ON public.practice_settings;
CREATE POLICY "Read practice settings" ON public.practice_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage practice settings" ON public.practice_settings
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff()) WITH CHECK (public.is_prayer_room_staff());

DROP POLICY IF EXISTS "Read practice stations"  ON public.practice_stations;
DROP POLICY IF EXISTS "Staff manage practice stations" ON public.practice_stations;
CREATE POLICY "Read practice stations" ON public.practice_stations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage practice stations" ON public.practice_stations
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff()) WITH CHECK (public.is_prayer_room_staff());

DROP POLICY IF EXISTS "Read practice bookings"  ON public.practice_bookings;
DROP POLICY IF EXISTS "Staff manage practice bookings" ON public.practice_bookings;
CREATE POLICY "Read practice bookings" ON public.practice_bookings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage practice bookings" ON public.practice_bookings
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff()) WITH CHECK (public.is_prayer_room_staff());

DROP POLICY IF EXISTS "Read practice people"  ON public.practice_booking_people;
DROP POLICY IF EXISTS "Staff manage practice people" ON public.practice_booking_people;
CREATE POLICY "Read practice people" ON public.practice_booking_people
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage practice people" ON public.practice_booking_people
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff()) WITH CHECK (public.is_prayer_room_staff());

-- Moves: the person moved, the admin who moved them, and staff. Written only
-- by practice_move_and_book_band().
DROP POLICY IF EXISTS "Read own or staff practice moves" ON public.practice_moves;
CREATE POLICY "Read own or staff practice moves" ON public.practice_moves
  FOR SELECT TO authenticated
  USING (affected_user_id = auth.uid() OR moved_by = auth.uid() OR public.is_prayer_room_staff());

-- ────────────────────────────────────────────────────────────
-- 7. NIGHT moves to 17:30–20:00
-- ────────────────────────────────────────────────────────────
-- The curated band is data (one template row per weekday, migration 171), not
-- a constant. Only rows still on the old time move, so a band staff have
-- already retimed by hand is left alone.
UPDATE public.prayer_room_template_blocks
   SET start_time = '17:30', end_time = '20:00'
 WHERE band_name = 'NIGHT'
   AND start_time = '17:00'
   AND end_time = '19:00';

-- Sets already generated from those rows for today onward follow them.
-- (None existed when this was written.)
UPDATE public.prayer_room_sets s
   SET start_time = '17:30', end_time = '20:00'
  FROM public.prayer_room_template_blocks t
 WHERE t.id = s.template_block_id
   AND t.band_name = 'NIGHT'
   AND s.status = 'scheduled'
   AND s.set_date >= (now() AT TIME ZONE 'Africa/Johannesburg')::date
   AND s.start_time = '17:00'
   AND s.end_time = '19:00';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT * FROM public.practice_settings;                -- 16:00–17:30, {2}, 60
--   SELECT slug, short_label, seat_type_id, max_people
--     FROM public.practice_stations ORDER BY sort_order;   -- 7 rows, vocals = 4
--   SELECT day_of_week, start_time, end_time
--     FROM public.prayer_room_template_blocks
--    WHERE band_name = 'NIGHT' ORDER BY day_of_week;       -- 5 rows, 17:30–20:00
--   SELECT public.practice_opens_at(DATE '2026-10-07');    -- 2026-10-04 00:00:00
-- ============================================================

-- ------------------------------------------------------------
-- ROLLBACK:
--   UPDATE public.prayer_room_template_blocks SET start_time = '17:00', end_time = '19:00'
--    WHERE band_name = 'NIGHT' AND start_time = '17:30' AND end_time = '20:00';
--   DROP FUNCTION IF EXISTS public.practice_move_and_book_band(date, time, time, text, jsonb, text);
--   DROP FUNCTION IF EXISTS public.practice_move_plan(date, time, time, text);
--   DROP FUNCTION IF EXISTS public.practice_cancel(uuid);
--   DROP FUNCTION IF EXISTS public.practice_book_band(date, time, time, text, jsonb);
--   DROP FUNCTION IF EXISTS public.practice_book_station(date, time, time, uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.practice_assert_members(uuid[]);
--   DROP FUNCTION IF EXISTS public.practice_can_book();
--   DROP FUNCTION IF EXISTS public.practice_hhmm(time);
--   DROP TABLE IF EXISTS public.practice_moves, public.practice_booking_people,
--                        public.practice_bookings, public.practice_stations,
--                        public.practice_settings;
--   DROP FUNCTION IF EXISTS public.practice_validate_person();
--   DROP FUNCTION IF EXISTS public.practice_validate_booking();
--   DROP FUNCTION IF EXISTS public.practice_now();
--   DROP FUNCTION IF EXISTS public.practice_opens_at(date);
-- ------------------------------------------------------------
