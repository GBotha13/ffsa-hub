-- ============================================================
-- FFSA Hub — Migration 058: Event ticketing RPC functions
-- ============================================================
-- Defines the atomic inventory + promo-redemption functions
-- called by the checkout flow. The Supabase JS client cannot do
-- "SET quantity_sold = quantity_sold + n" directly — these
-- functions move that arithmetic into Postgres so the conditional
-- UPDATE is atomic.
--
-- Append-only — adds functions only, no schema changes.
-- Apply by hand in the Supabase SQL Editor; types regenerate
-- automatically next run.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- reserve_ticket_inventory
-- ------------------------------------------------------------
-- Atomic inventory hold for checkout. Single UPDATE with all
-- guards in the WHERE — at most one row changes; concurrent
-- callers serialise on the row lock. NULL return = rejected
-- (sold out, inactive, or outside the sales window).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_ticket_inventory(
  p_ticket_type_id uuid,
  p_qty            integer
) RETURNS public.ticket_types
LANGUAGE plpgsql
AS $$
DECLARE
  updated public.ticket_types;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'reserve_ticket_inventory: qty must be > 0, got %', p_qty;
  END IF;

  UPDATE public.ticket_types
  SET    quantity_sold = quantity_sold + p_qty
  WHERE  id = p_ticket_type_id
    AND  is_active = true
    AND  (capacity IS NULL OR quantity_sold + p_qty <= capacity)
    AND  (sales_start_at IS NULL OR sales_start_at <= now())
    AND  (sales_end_at   IS NULL OR sales_end_at   >  now())
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

COMMENT ON FUNCTION public.reserve_ticket_inventory(uuid, integer) IS
  'Atomic inventory hold for checkout. Returns the updated row, or NULL if guards fail (sold out / outside window / inactive).';


-- ────────────────────────────────────────────────────────────
-- release_ticket_inventory
-- ------------------------------------------------------------
-- Decrement inventory when a pending checkout expires or a paid
-- order is refunded. GREATEST(0, ...) prevents an underflow if
-- the caller ever double-releases.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.release_ticket_inventory(
  p_ticket_type_id uuid,
  p_qty            integer
) RETURNS public.ticket_types
LANGUAGE plpgsql
AS $$
DECLARE
  updated public.ticket_types;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'release_ticket_inventory: qty must be > 0, got %', p_qty;
  END IF;

  UPDATE public.ticket_types
  SET    quantity_sold = GREATEST(0, quantity_sold - p_qty)
  WHERE  id = p_ticket_type_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

COMMENT ON FUNCTION public.release_ticket_inventory(uuid, integer) IS
  'Decrement inventory (clamped to 0). For expired checkouts and refunds.';


-- ────────────────────────────────────────────────────────────
-- redeem_promo_code
-- ------------------------------------------------------------
-- Atomic +1 on redemption_count, guarded against expiry,
-- deactivation, and max_redemptions. NULL return = rejected.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_promo_code_id uuid
) RETURNS public.promo_codes
LANGUAGE plpgsql
AS $$
DECLARE
  updated public.promo_codes;
BEGIN
  UPDATE public.promo_codes
  SET    redemption_count = redemption_count + 1
  WHERE  id = p_promo_code_id
    AND  is_active = true
    AND  (max_redemptions IS NULL OR redemption_count + 1 <= max_redemptions)
    AND  (valid_from  IS NULL OR valid_from  <= now())
    AND  (valid_until IS NULL OR valid_until >  now())
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

COMMENT ON FUNCTION public.redeem_promo_code(uuid) IS
  'Atomically increment promo redemption_count if still redeemable. Returns updated row, or NULL on rejection.';


-- ────────────────────────────────────────────────────────────
-- Grants
-- ------------------------------------------------------------
-- Public checkout writes via the service-role client; admin staff
-- may also reach these via the admin UI under their own session.
-- ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.reserve_ticket_inventory(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_ticket_inventory(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(uuid)                 TO authenticated, service_role;


-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT proname FROM pg_proc
--   WHERE proname IN ('reserve_ticket_inventory',
--                     'release_ticket_inventory',
--                     'redeem_promo_code');
--   -- 3 rows
-- ============================================================
