-- 316_prayer_room_auditorium_blocks_practice.sql
--
-- An approved booking of the auditorium closes the prayer room for practice,
-- including its set-up and set-down. A prayer-room block-out does the same.
-- Pending, denied and cancelled bookings do not, and neither does any other
-- venue.
--
-- practice_book_station / practice_book_band / practice_move_and_book_band
-- keep their signatures. They insert practice_bookings, and
-- practice_validate_booking (unchanged signature) refuses the row. A direct
-- insert by staff hits the same trigger.
--
-- The check runs as SECURITY DEFINER so a practice member, who may not hold
-- bookings.view, is still refused. It returns no booking row. The errors say
-- the Auditorium is booked, or the room is blocked out — never who booked it.
-- If the read itself fails, the booking is rejected.

CREATE OR REPLACE FUNCTION public.practice_assert_room_open(p_date date, p_start time, p_end time)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auditorium boolean;
  v_blockout   boolean;
BEGIN
  IF p_date IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'That practice time is not valid.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Fail closed. A missing table, a denied read, anything — do not book.
  BEGIN
    SELECT EXISTS (
      SELECT 1
        FROM public.venue_bookings b
        JOIN public.venues v ON v.id = b.venue_id
       WHERE v.slug = 'auditorium'
         AND b.status = 'approved'
         AND p_date >= b.booking_date
         AND p_date <= COALESCE(b.end_date, b.booking_date)
         AND (
           -- Multi-day bookings occupy every covered day, the whole day.
           (b.end_date IS NOT NULL AND b.end_date > b.booking_date)
           -- No usable clock time occupies the whole day too.
           OR COALESCE(b.setup_time, b.start_time) IS NULL
           OR COALESCE(b.setdown_time, b.end_time) IS NULL
           -- Otherwise set-up through set-down. Touching an edge is free:
           -- the comparisons are strict.
           OR (
             COALESCE(b.setup_time, b.start_time) < p_end
             AND p_start < GREATEST(
               COALESCE(b.setdown_time, b.end_time),
               COALESCE(b.setup_time, b.start_time)
             )
           )
         )
    ) INTO v_auditorium;

    SELECT EXISTS (
      SELECT 1
        FROM public.prayer_room_blockouts o
       WHERE p_date >= o.block_date
         AND p_date <= o.end_date
         AND (
           o.start_time IS NULL
           OR o.end_time IS NULL
           OR (o.start_time < p_end AND p_start < o.end_time)
         )
    ) INTO v_blockout;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'The prayer room could not be checked against Auditorium bookings. Nothing was booked.'
        USING ERRCODE = 'check_violation';
  END;

  IF v_auditorium IS NULL OR v_blockout IS NULL THEN
    RAISE EXCEPTION 'The prayer room could not be checked against Auditorium bookings. Nothing was booked.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_auditorium THEN
    RAISE EXCEPTION 'The Auditorium is booked then, so practice is closed.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_blockout THEN
    RAISE EXCEPTION 'The prayer room is blocked out then, so practice is closed.'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.practice_assert_room_open(date, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.practice_assert_room_open(date, time, time) TO authenticated;

-- Same signature and search_path as migration 224. The room check is the
-- only addition, and it runs for a new or moved active booking. Cancelling
-- one, or saving it without changing when it is, stays allowed.
CREATE OR REPLACE FUNCTION public.practice_validate_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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

  PERFORM public.practice_assert_room_open(NEW.practice_date, NEW.start_time, NEW.end_time);

  RETURN NEW;
END;
$$;
