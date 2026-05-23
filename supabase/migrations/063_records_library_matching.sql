-- ============================================================
-- FFSA Hub — Migration 063: Records Library matching engine
-- ============================================================
-- SECURITY DEFINER functions that:
--   1. Find candidate library_persons for a given user.
--   2. Auto-link the high-confidence ones and queue the rest.
--   3. Link a queued match (called from the review UI).
--   4. Unlink a person (called from the review UI / admin).
--
-- Confidence tiers:
--   HIGH    — email_normalized matches AND lower(last_name) matches
--             → auto-linked, all child records cascade to user_id
--   MEDIUM  — email_normalized matches (no last-name match)
--             OR  lower(last_name) matches AND date_of_birth matches
--             → queued for super admin review
--   (anything weaker is ignored)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- _library_cascade_link — internal helper
-- Links a person to a user and propagates the user_id to every
-- child record (applications, payments, enrollments, documents).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._library_cascade_link(
  p_person_id    uuid,
  p_user_id      uuid,
  p_link_method  text,
  p_linked_by    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.library_persons
  SET linked_user_id = p_user_id,
      linked_at      = now(),
      linked_by      = p_linked_by,
      link_method    = p_link_method
  WHERE id = p_person_id;

  UPDATE public.library_applications SET user_id = p_user_id WHERE person_id = p_person_id;
  UPDATE public.library_payments     SET user_id = p_user_id WHERE person_id = p_person_id;
  UPDATE public.library_enrollments  SET user_id = p_user_id WHERE person_id = p_person_id;
  UPDATE public.library_documents    SET user_id = p_user_id WHERE person_id = p_person_id;
END;
$$;

COMMENT ON FUNCTION public._library_cascade_link IS
  'Internal: link a library_person to a user and propagate user_id to all child records. Do not call directly from the app; use auto_link_library_records_for_user or approve_library_match.';

-- ────────────────────────────────────────────────────────────
-- find_library_matches_for_user
-- Returns candidate matches for a given user. Pure SELECT — no
-- writes. Used by the admin UI to preview before linking.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.find_library_matches_for_user(p_user_id uuid)
RETURNS TABLE (
  person_id     uuid,
  email         text,
  first_name    text,
  last_name     text,
  date_of_birth date,
  confidence    text,
  match_reason  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT
      lower(btrim(u.email))     AS email_n,
      lower(u.last_name)        AS last_n,
      u.date_of_birth           AS dob
    FROM public.users u
    WHERE u.id = p_user_id
  )
  SELECT
    lp.id,
    lp.email,
    lp.first_name,
    lp.last_name,
    lp.date_of_birth,
    CASE
      WHEN lp.email_normalized = t.email_n AND lower(lp.last_name) = t.last_n
        THEN 'high'
      WHEN lp.email_normalized = t.email_n
        THEN 'medium'
      WHEN lower(lp.last_name) = t.last_n
        AND lp.date_of_birth IS NOT NULL
        AND lp.date_of_birth = t.dob
        THEN 'medium'
      ELSE 'low'
    END AS confidence,
    CASE
      WHEN lp.email_normalized = t.email_n AND lower(lp.last_name) = t.last_n
        THEN 'Email + last name match'
      WHEN lp.email_normalized = t.email_n
        THEN 'Email match only'
      WHEN lower(lp.last_name) = t.last_n
        AND lp.date_of_birth = t.dob
        THEN 'Last name + DOB match'
      ELSE 'Weak match'
    END AS match_reason
  FROM public.library_persons lp, target t
  WHERE lp.linked_user_id IS NULL
    AND (
      lp.email_normalized = t.email_n
      OR (lower(lp.last_name) = t.last_n AND lp.date_of_birth = t.dob)
    );
$$;

COMMENT ON FUNCTION public.find_library_matches_for_user IS
  'Returns candidate library_person matches for a user. Read-only. Confidence is high|medium|low; the app only acts on high (auto) and medium (queue).';

-- ────────────────────────────────────────────────────────────
-- auto_link_library_records_for_user
-- Runs the matcher and: auto-links HIGH matches, queues MEDIUM
-- matches, ignores LOW. Returns counts so callers can surface a
-- toast. Safe to call multiple times (idempotent via uniques).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_link_library_records_for_user(p_user_id uuid)
RETURNS TABLE (
  auto_linked  integer,
  queued       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_linked integer := 0;
  v_queued      integer := 0;
  v_match RECORD;
BEGIN
  FOR v_match IN
    SELECT * FROM public.find_library_matches_for_user(p_user_id)
  LOOP
    IF v_match.confidence = 'high' THEN
      PERFORM public._library_cascade_link(
        v_match.person_id,
        p_user_id,
        'auto',
        NULL
      );
      v_auto_linked := v_auto_linked + 1;

    ELSIF v_match.confidence = 'medium' THEN
      INSERT INTO public.library_match_queue
        (person_id, user_id, match_reason, confidence)
      VALUES
        (v_match.person_id, p_user_id, v_match.match_reason, 'medium')
      ON CONFLICT (person_id, user_id) DO NOTHING;
      v_queued := v_queued + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_auto_linked, v_queued;
END;
$$;

COMMENT ON FUNCTION public.auto_link_library_records_for_user IS
  'Idempotent: run after user creation or on demand. Auto-links high-confidence matches and queues medium ones. Returns counts.';

-- ────────────────────────────────────────────────────────────
-- approve_library_match — called from the review UI
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_library_match(
  p_queue_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id uuid;
  v_user_id   uuid;
BEGIN
  IF NOT (public.is_admin() OR public.has_permission('records_library.manage')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT person_id, user_id
    INTO v_person_id, v_user_id
  FROM public.library_match_queue
  WHERE id = p_queue_id AND status = 'pending';

  IF v_person_id IS NULL THEN
    RAISE EXCEPTION 'Queue item not found or already resolved';
  END IF;

  PERFORM public._library_cascade_link(
    v_person_id,
    v_user_id,
    'queue_approval',
    auth.uid()
  );

  UPDATE public.library_match_queue
  SET status           = 'approved',
      resolved_by      = auth.uid(),
      resolved_at      = now(),
      resolution_notes = p_notes
  WHERE id = p_queue_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- reject_library_match — drop a queued match
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_library_match(
  p_queue_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_permission('records_library.manage')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.library_match_queue
  SET status           = 'rejected',
      resolved_by      = auth.uid(),
      resolved_at      = now(),
      resolution_notes = p_notes
  WHERE id = p_queue_id AND status = 'pending';
END;
$$;

-- ────────────────────────────────────────────────────────────
-- manual_link_library_person — admin override
-- Used by the admin UI to link any person to any user directly.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.manual_link_library_person(
  p_person_id uuid,
  p_user_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_permission('records_library.manage')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  PERFORM public._library_cascade_link(
    p_person_id,
    p_user_id,
    'manual',
    auth.uid()
  );
END;
$$;

-- ────────────────────────────────────────────────────────────
-- unlink_library_person — admin override (correction)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.unlink_library_person(p_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_permission('records_library.manage')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.library_persons
  SET linked_user_id = NULL,
      linked_at      = NULL,
      linked_by      = NULL,
      link_method    = NULL
  WHERE id = p_person_id;

  UPDATE public.library_applications SET user_id = NULL WHERE person_id = p_person_id;
  UPDATE public.library_payments     SET user_id = NULL WHERE person_id = p_person_id;
  UPDATE public.library_enrollments  SET user_id = NULL WHERE person_id = p_person_id;
  UPDATE public.library_documents    SET user_id = NULL WHERE person_id = p_person_id;
END;
$$;
