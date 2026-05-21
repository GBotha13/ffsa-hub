-- ============================================================
-- FFSA Hub — Migration 057: Event Ticketing
-- ============================================================
-- Adds paid ticketing to the Events module. External customers
-- buy tickets to an event; the purchase flows into the existing
-- CRM (contacts, dedup, labels, event_registrations,
-- activity_events).
--
-- Design: a ticket is a paid event_registration with a
-- scannable code. Payment + ticket issuance is synchronous;
-- CRM resolution (buyer -> contact) is async and review-queue
-- safe. See FFSA_Hub_Events_Ticketing_Spec.md.
--
-- New tables: payment_fee_profiles, ticket_types, promo_codes,
--             orders, tickets
-- Touches:    events (+ ticketing_enabled, + public_slug)
--             event_registrations (+ order_id)
--
-- Append-only. No data destruction. Apply by hand in the
-- Supabase SQL Editor, then regenerate src/types/database.ts.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. events — ticketing flag + public storefront slug
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticketing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug       text;

-- Slug is unique among events that have one; NULLs are allowed
-- (non-ticketed events don't need a public storefront URL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_public_slug
  ON public.events (public_slug)
  WHERE public_slug IS NOT NULL;

COMMENT ON COLUMN public.events.ticketing_enabled IS
  'When true, the event has a public ticket storefront at /events/<public_slug>.';
COMMENT ON COLUMN public.events.public_slug IS
  'URL slug for the public ticket storefront. Required when ticketing_enabled is true (enforced in the app layer).';


-- ────────────────────────────────────────────────────────────
-- 2. payment_fee_profiles — processor fee rates for gross-up
-- ------------------------------------------------------------
-- The fee-inclusive ("gross-up") pricing function reads these.
-- One row per provider. Editable by finance so rates change
-- without a deploy. percent_bps is basis points (290 = 2.90%).
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.payment_fee_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL UNIQUE CHECK (provider IN ('payfast', 'stripe')),
  percent_bps integer NOT NULL CHECK (percent_bps >= 0),
  fixed_cents integer NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Placeholder rates — finance must confirm against the live
-- PayFast / Stripe contracts before launch.
INSERT INTO public.payment_fee_profiles (provider, percent_bps, fixed_cents) VALUES
  ('payfast', 290, 200),
  ('stripe',  350, 300)
ON CONFLICT (provider) DO NOTHING;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payment_fee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.payment_fee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins, finance, events can read fee profiles"
  ON public.payment_fee_profiles FOR SELECT
  USING (public.is_admin() OR public.has_role('finance_admin') OR public.has_role('events_admin'));

CREATE POLICY "Admins and finance can manage fee profiles"
  ON public.payment_fee_profiles FOR ALL
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

COMMENT ON TABLE public.payment_fee_profiles IS
  'Processor fee rates used by the gross-up pricing function. percent_bps is basis points.';


-- ────────────────────────────────────────────────────────────
-- 3. ticket_types — a purchasable tier on an event
-- ------------------------------------------------------------
-- target_net_cents    = what FFSA wants to keep (staff input).
-- display_price_cents = grossed-up price the buyer pays,
--   computed at save time. For pwyw it is the minimum amount.
-- Early-bird is just a tier with a sales_end_at — no special
-- pricing logic.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.ticket_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  pricing_mode        text NOT NULL DEFAULT 'fixed'
                      CHECK (pricing_mode IN ('fixed', 'pwyw')),
  target_net_cents    integer NOT NULL DEFAULT 0 CHECK (target_net_cents >= 0),
  display_price_cents integer NOT NULL DEFAULT 0 CHECK (display_price_cents >= 0),
  capacity            integer CHECK (capacity IS NULL OR capacity >= 0),
  quantity_sold       integer NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  max_per_order       integer CHECK (max_per_order IS NULL OR max_per_order > 0),
  sales_start_at      timestamptz,
  sales_end_at        timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Belt-and-braces: the DB rejects an oversell even if the
  -- application's atomic inventory hold is somehow bypassed.
  CONSTRAINT ticket_types_capacity_not_exceeded
    CHECK (capacity IS NULL OR quantity_sold <= capacity)
);

CREATE INDEX idx_ticket_types_event ON public.ticket_types (event_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read ticket types"
  ON public.ticket_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and events can manage ticket types"
  ON public.ticket_types FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

COMMENT ON TABLE public.ticket_types IS
  'A purchasable ticket tier on an event. The public storefront reads these via the service-role client.';
COMMENT ON COLUMN public.ticket_types.target_net_cents IS
  'Amount (ZAR cents) FFSA intends to keep after processor fees. Staff input.';
COMMENT ON COLUMN public.ticket_types.display_price_cents IS
  'Grossed-up price (ZAR cents) the buyer sees and pays. Computed from target_net_cents at save time. For pwyw, the minimum.';


-- ────────────────────────────────────────────────────────────
-- 4. promo_codes — discount and comp codes
-- ------------------------------------------------------------
-- kind = 'percent'      -> uses percent_off
--        'fixed_amount' -> uses amount_off_cents
--        'comp'         -> 100% off; issues free tickets and
--                          skips the payment provider entirely.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.promo_codes (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code                      text NOT NULL,
  kind                      text NOT NULL CHECK (kind IN ('percent', 'fixed_amount', 'comp')),
  percent_off               integer CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_off_cents          integer CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  applies_to_ticket_type_id uuid REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  max_redemptions           integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count          integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  valid_from                timestamptz,
  valid_until               timestamptz,
  is_active                 boolean NOT NULL DEFAULT true,
  created_by                uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_codes_event ON public.promo_codes (event_id);
CREATE UNIQUE INDEX idx_promo_codes_event_code ON public.promo_codes (event_id, lower(code));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and events can read promo codes"
  ON public.promo_codes FOR SELECT
  USING (public.is_admin() OR public.has_role('events_admin'));

CREATE POLICY "Admins and events can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

COMMENT ON TABLE public.promo_codes IS
  'Per-event discount and comp codes. Codes are secret; checkout validation runs via the service-role client.';


-- ────────────────────────────────────────────────────────────
-- 5. orders — one purchase
-- ------------------------------------------------------------
-- buyer_* columns are the raw checkout input (a snapshot).
-- buyer_contact_id is filled by the async CRM-resolution step
-- and stays NULL if the buyer lands in the dedup review queue —
-- the sale and the tickets are never blocked on it.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  buyer_contact_id    uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  buyer_first_name    text NOT NULL,
  buyer_last_name     text NOT NULL,
  buyer_email         text NOT NULL,
  buyer_phone         text,
  marketing_consent   boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refunded', 'partially_refunded')),
  contact_resolution  text NOT NULL DEFAULT 'pending'
                      CHECK (contact_resolution IN ('pending', 'resolved', 'review_queued')),
  payment_provider    text CHECK (payment_provider IS NULL OR payment_provider IN ('payfast', 'stripe')),
  currency            text NOT NULL DEFAULT 'ZAR',
  subtotal_cents      integer NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents      integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  donation_cents      integer NOT NULL DEFAULT 0 CHECK (donation_cents >= 0),
  total_cents         integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  refund_cents        integer NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
  promo_code_id       uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  provider_reference  text,
  provider_payment_id text,
  staff_notes         text,
  expires_at          timestamptz,
  paid_at             timestamptz,
  cancelled_at        timestamptz,
  refunded_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_event ON public.orders (event_id);
CREATE INDEX idx_orders_event_status ON public.orders (event_id, status);
CREATE INDEX idx_orders_buyer_contact ON public.orders (buyer_contact_id) WHERE buyer_contact_id IS NOT NULL;
CREATE INDEX idx_orders_buyer_email ON public.orders (lower(buyer_email));
CREATE UNIQUE INDEX idx_orders_provider_reference ON public.orders (provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins, events, finance can read orders"
  ON public.orders FOR SELECT
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('finance_admin'));

CREATE POLICY "Admins, events, finance can manage orders"
  ON public.orders FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin') OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin') OR public.has_role('finance_admin'));

COMMENT ON TABLE public.orders IS
  'One ticket purchase. Public checkout + payment webhooks write via the service-role client; staff read/manage under RLS.';
COMMENT ON COLUMN public.orders.contact_resolution IS
  'Async CRM step: pending = not yet resolved, resolved = buyer linked to a contact, review_queued = dedup conflict sent to the manual review queue.';
COMMENT ON COLUMN public.orders.provider_reference IS
  'Provider-side checkout reference used for webhook reconciliation (e.g. Stripe checkout session id).';


-- ────────────────────────────────────────────────────────────
-- 6. tickets — one issued seat, one scannable code
-- ------------------------------------------------------------
-- v1 is buyer-only: tickets carry no holder identity. The QR
-- encodes `code`. Named-attendee assignment is v2.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE RESTRICT,
  code           text NOT NULL UNIQUE,
  status         text NOT NULL DEFAULT 'valid'
                 CHECK (status IN ('valid', 'checked_in', 'void')),
  checked_in_at  timestamptz,
  checked_in_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_order ON public.tickets (order_id);
CREATE INDEX idx_tickets_event ON public.tickets (event_id);
CREATE INDEX idx_tickets_event_status ON public.tickets (event_id, status);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and events can read tickets"
  ON public.tickets FOR SELECT
  USING (public.is_admin() OR public.has_role('events_admin'));

CREATE POLICY "Admins and events can manage tickets"
  ON public.tickets FOR ALL
  USING (public.is_admin() OR public.has_role('events_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('events_admin'));

COMMENT ON TABLE public.tickets IS
  'One issued seat. `code` is unguessable and encoded in the QR. Door check-in flips status valid -> checked_in.';


-- ────────────────────────────────────────────────────────────
-- 7. event_registrations — link to the originating order
-- ------------------------------------------------------------
-- A paid order produces ONE event_registration for the buyer
-- (the existing UNIQUE (contact_id, event_id) constraint
-- already guarantees one per contact per event). order_id is
-- NULL for free / form-based registrations.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_order
  ON public.event_registrations (order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON COLUMN public.event_registrations.order_id IS
  'The ticket order this registration came from. NULL for free / form-based registrations.';


-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('payment_fee_profiles','ticket_types',
--                     'promo_codes','orders','tickets');
--   -- all five relrowsecurity = true
--
--   SELECT provider, percent_bps, fixed_cents
--   FROM public.payment_fee_profiles;          -- 2 rows
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='events'
--     AND column_name IN ('ticketing_enabled','public_slug');  -- 2 rows
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='event_registrations'
--     AND column_name='order_id';              -- 1 row
-- ============================================================
