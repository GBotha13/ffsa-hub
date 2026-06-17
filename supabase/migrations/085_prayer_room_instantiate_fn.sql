-- ============================================================
-- FFSA Hub — Prayer Room week instantiation
-- ============================================================
-- ensure_prayer_room_week(p_week_start): for each active template block,
-- create the concrete devo set for this week (idempotent) and expand its
-- role_needs into open roster slots.
--
-- Convention: p_week_start is the SUNDAY that begins the week; template
-- day_of_week is 0=Sunday..6=Saturday, so set_date = p_week_start + day_of_week.
--
-- Additive only: ON CONFLICT DO NOTHING means editing the template never
-- mutates already-generated weeks — re-running just fills in newly-added blocks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_prayer_room_week(p_week_start date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b       record;
  created int := 0;
  new_set uuid;
  r       text;
  n       int;
BEGIN
  -- only coordinators / staff may generate the schedule (auth.uid() is the caller)
  IF NOT public.is_prayer_room_staff() THEN
    RAISE EXCEPTION 'Only prayer room staff can generate the weekly schedule';
  END IF;

  FOR b IN SELECT * FROM public.prayer_room_template_blocks WHERE is_active LOOP
    INSERT INTO public.prayer_room_sets
      (template_block_id, week_start, set_date, start_time, end_time, title)
    VALUES
      (b.id, p_week_start, p_week_start + b.day_of_week, b.start_time, b.end_time, b.title)
    ON CONFLICT (template_block_id, set_date) DO NOTHING
    RETURNING id INTO new_set;

    IF new_set IS NOT NULL THEN
      created := created + 1;
      -- expand {"role": count} into that many open slots (roles must match the
      -- prayer_room_set_slots CHECK: worship_leader | vocals | instrument | prayer_leader)
      FOR r, n IN SELECT key, value::int FROM jsonb_each_text(b.role_needs) LOOP
        IF n > 0 THEN
          INSERT INTO public.prayer_room_set_slots (set_id, role, position)
          SELECT new_set, r, gs FROM generate_series(1, n) gs;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN created;
END;
$$;
