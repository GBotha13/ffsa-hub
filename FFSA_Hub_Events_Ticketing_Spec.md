# FFSA Hub — Events Ticketing Spec

Paid ticketing inside the Events module. External customers buy tickets to FFSA
events; every purchase flows into the existing CRM (contacts, dedup, labels,
`event_registrations`, `activity_events`).

Pair this with `CLAUDE.md` (project conventions) and `FFSA_Hub_CRM_Spec.md` (the
CRM design this builds on). Source of truth for the ticketing build.

---

## 1. Core design

The Events module already runs a **free registration pipeline**: an event owns
QR-code forms, a submission runs dedup → `contacts`, applies the event's
`base_label_id` + `event_outcomes` labels, creates an `event_registrations` row,
and writes `activity_events`.

Ticketing **inserts two stages** into that pipeline — it does not replace it:

1. **Money** — a payment provider (PayFast for SA, Stripe for international).
2. **A ticket artifact** — an unguessable code, QR-encoded, scannable at the door.

> A ticket is a **paid `event_registration` with a code on it.** Everything
> after the sale — contact, label, timeline, attendance — reuses the pipeline
> that already exists.

**The load-bearing principle:** decouple money from CRM resolution. Payment and
ticket issuance are **synchronous and must never fail**. Buyer → contact
resolution is **async and review-queue safe** — the CRM dedup is a *manual*
queue, and a paying customer must never wait on it.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Event types driving this | Conferences / paid intensives **and** outreach gatherings (Send Night, Ministry Night) |
| 2 | Whose details enter the CRM | **Buyer only.** Other seats are anonymous "admit one" codes. Named-attendee capture is v2. |
| 3 | v1 ticketing features | Multiple tiers · promo & comp codes · pay-what-you-want / donation add-on |
| 4 | Refunds | **Staff-processed only.** No buyer self-service in v1. |
| 5 | Storefront | **Standalone `/events/[slug]` links only.** No "what's on" index page. |
| 6 | Payments | **PayFast** (SA) ships in v1; **Stripe** (international) ships in v1.5 behind the same abstraction. |
| 7 | Fee handling | **Fee-inclusive pricing.** The displayed price is grossed up to cover the processor fee — buyers see one all-in price, never a fee line. |
| 8 | Currency | **ZAR only.** Multi-currency display is v3. |
| 9 | Marketing consent | Every buyer becomes a contact with full purchase history. The email-list **label is applied only on ticked consent**, with a consent record. Unticked = no label, purchase still fully recorded. |

---

## 3. Data model

All schema lives in `supabase/migrations/057_event_ticketing.sql` (append-only,
applied by hand in the Supabase SQL Editor). Money is **ZAR cents (integer)**.

### New tables

- **`payment_fee_profiles`** — one row per provider (`payfast`, `stripe`):
  `percent_bps`, `fixed_cents`. Read by the gross-up function. Editable by
  `finance_admin` so rates change without a deploy.
- **`ticket_types`** — a purchasable tier on an event. `pricing_mode`
  (`fixed` | `pwyw`), `target_net_cents` (staff input), `display_price_cents`
  (grossed-up, computed at save), `capacity`, `quantity_sold`, `max_per_order`,
  `sales_start_at` / `sales_end_at`. Early-bird = a tier with a `sales_end_at`;
  no special pricing logic. A CHECK constraint rejects oversell at the DB level.
- **`promo_codes`** — per-event. `kind` (`percent` | `fixed_amount` | `comp`),
  value, optional tier scope, `max_redemptions`, validity window. `comp` = 100%
  off and skips the payment provider entirely.
- **`orders`** — one purchase. Buyer snapshot (`buyer_first_name`,
  `buyer_last_name`, `buyer_email`, `buyer_phone`, `marketing_consent`),
  `status`, `contact_resolution`, `payment_provider`, money columns,
  `provider_reference`, `expires_at`. `buyer_contact_id` is filled async and
  stays NULL while a dedup conflict sits in the review queue.
- **`tickets`** — one issued seat. Unguessable `code` (QR payload), `status`
  (`valid` | `checked_in` | `void`), `checked_in_at` / `checked_in_by`.

### Touches to existing tables

- `events` — `+ ticketing_enabled boolean`, `+ public_slug text` (unique where set).
- `event_registrations` — `+ order_id uuid` (NULL for free / form registrations).

### Reused, not rebuilt

`contacts` + dedup review queue, `labels` / `contact_labels` + the event's
`base_label_id`, `event_registrations`, `activity_events`. New
`activity_events` types: `ticket_purchased`, `ticket_refunded`,
`ticket_checked_in`.

### Buyer-only model note

`contacts.first_name` / `last_name` are NOT NULL — checkout must collect first
and last name separately. One paid order → one buyer contact → one
`event_registration` (the existing `UNIQUE (contact_id, event_id)` enforces
one-per-contact) → N anonymous `tickets`.

---

## 4. Fee-inclusive pricing (the gross-up)

Staff enter the **target net** (what FFSA wants to keep). The system computes
the **display price** the buyer pays:

```
display = ceil( (target_net + fixed_fee) / (1 - percent_fee) )
```

- One displayed price, both providers. It is grossed up against the **worst
  (highest) active fee profile** — so FFSA is never short; PayFast sales net a
  few rand extra.
- Applies to **fixed-price tiers only.** Pay-what-you-want amounts and the
  donation add-on are charged exactly as entered, fee absorbed out of them
  (grossing up a R50 gift to R53 is bad UX).
- `display_price_cents` is **locked at save time**. Changing a fee profile does
  not retroactively reprice live tickets — staff re-save a tier to recompute
  before launch.
- Lives in `src/lib/payments/pricing.ts`; surfaced as a live preview in the
  admin Tickets tab.

---

## 5. Payment providers

One abstraction, two adapters — `src/lib/payments/provider.ts`:

```
PaymentProvider {
  createCheckout(order, returnUrls) -> { redirectUrl }
  verifyWebhook(request)            -> { orderRef, status, providerPaymentId }
}
```

Orders, tickets, fulfilment and the webhook→fulfil path are **provider-agnostic**.
Only checkout creation and webhook verification differ.

- **PayFast** (`src/lib/payments/payfast.ts`, v1) — signed form POST to the
  process endpoint; ITN verified by signature + source check + amount match +
  server-side postback. Sandbox/live via `PAYFAST_MODE`.
- **Stripe** (`src/lib/payments/stripe.ts`, v1.5) — Checkout Session + webhook
  with signature verification.

Buyer **picks the provider explicitly at checkout** ("South African card" /
"International card") — no geo-guessing.

---

## 6. Checkout flow

1. **Storefront** `/events/[slug]` (new route in `(public)`) — event info, tiers,
   live availability. Server component reads via the service-role client.
2. Buyer picks quantities, optional promo code, optional donation add-on, enters
   first/last name + email + phone. Spam protection on the public endpoint.
3. `POST /api/events/[id]/checkout`:
   - Validate availability; **atomic inventory hold** — conditional
     `UPDATE ticket_types SET quantity_sold = quantity_sold + n WHERE id = ?
     AND (capacity IS NULL OR quantity_sold + n <= capacity)`; 0 rows = sold out.
   - Create a `pending` order with a short `expires_at`; apply promo code.
   - **Zero-total branch** (full comp code) → skip the provider, mark `paid`,
     fulfil immediately.
   - Else → `provider.createCheckout(...)`, return the redirect URL.
4. Buyer pays on the provider-hosted page.
5. **Webhook is the source of truth** (never the success redirect):
   verify → idempotency check → mark order `paid` → **fulfilment** (§7) →
   **CRM resolution** (§8).
6. Expired / cancelled checkout → release the inventory hold, mark order
   `expired` / `cancelled`.

---

## 7. Fulfilment (synchronous — must not fail)

On a verified payment: issue `tickets` rows (one per seat, unguessable `code`),
generate QR codes, send the ticket confirmation email via Mailtrap (new
template, QR inline). PDF tickets and wallet passes are v2.

---

## 8. CRM resolution (async — review-queue safe)

After fulfilment, resolve the buyer into the CRM:

- Dedup on `email_normalized` / `phone_normalized` (existing logic). Clean match
  or create → set `orders.buyer_contact_id`, create the `event_registration`
  (status `confirmed`, `order_id` set), write a `ticket_purchased`
  `activity_event`, set `contact_resolution = 'resolved'`.
- Dedup conflict → existing **manual review queue**; `contact_resolution =
  'review_queued'`. The order and tickets are already fulfilled — nothing is
  blocked.
- **Consent:** if `orders.marketing_consent` is true, apply the event's
  `base_label_id` (the email-list label) and write a consent record
  (timestamp / IP / source). If false, no label — the contact,
  `event_registration` and order history still exist and stay queryable.

---

## 9. Admin & door

- **Tickets tab** on `events/[id]` (beside Outcomes / Roles / Forms) — tier CRUD
  with live gross-up preview, promo/comp code CRUD, `ticketing_enabled` +
  `public_slug`.
- **Orders / sales view** per event — buyer, tier, qty, total, status, revenue.
  Staff **refund** → provider refund API, void tickets, record `refund_cents`,
  write `activity_event`.
- **Door check-in** — camera QR scan → validate `tickets.code` → `valid` →
  `checked_in`; flag already-used; reject `void`. Gated to `admin` +
  `events_admin`.

---

## 10. Scope

**v1** — schema (057), PayFast, gross-up engine, public storefront + checkout,
multiple tiers with sales windows, promo + comp codes, pay-what-you-want +
donation add-on, atomic inventory, ticket issuance + QR + Mailtrap email,
buyer → CRM resolution, admin Tickets tab + orders list + staff refunds, door
check-in scanner.

**v1.5** — Stripe (international), provider choice at checkout.

**v2** — named-attendee capture / assignment, Finance module + Xero
reconciliation, tokenised "my tickets" page, waitlists, PDF / wallet passes.

**v3** — buyer self-service refunds, reserved seating, member pricing via
existing labels, multi-session conferences, multi-currency display.

---

## 11. Ticket pack (v1)

Build in order; later tickets assume earlier ones shipped.

1. **Schema migration 057 + this spec.** *(done)*
2. **Regenerate types + dependencies** — `src/types/database.ts` after 057 is
   applied; add `qrcode` + a browser QR-scanner lib.
3. **Gross-up pricing library** — `src/lib/payments/pricing.ts`.
4. **Payment provider abstraction + PayFast adapter** — `provider.ts`,
   `payfast.ts`.
5. **Ticketing service** — `src/services/ticketing.ts` (incl. atomic hold).
6. **Admin Tickets tab** — tier + promo code CRUD, gross-up preview.
7. **Public storefront** — `src/app/(public)/events/[slug]`.
8. **Checkout API** — `/api/events/[id]/checkout`, inventory hold, comp branch.
9. **PayFast ITN webhook** — `/api/integrations/payfast/notify`; expiry release.
10. **Fulfilment** — issue tickets, QR, Mailtrap confirmation template.
11. **CRM resolution** — contact, consent label, registration, activity.
12. **Admin orders/sales list + staff refunds.**
13. **Door check-in scanner** + validation.

---

## 12. Environment variables

v1 (PayFast):

```
PAYFAST_MERCHANT_ID
PAYFAST_MERCHANT_KEY
PAYFAST_PASSPHRASE
PAYFAST_MODE                 # sandbox | live
NEXT_PUBLIC_APP_URL          # existing — return / cancel / notify URLs
```

v1.5 adds `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Add every new var to `.env.local.example`
with a placeholder.

---

## 13. Open items

- **Spam protection** on the public checkout — confirm whether Cloudflare
  Turnstile keys are provisioned; otherwise honeypot + rate-limit.
- **Finance / Xero reconciliation** of ticket revenue — v2; v1 reconciles in the
  PayFast dashboard.
- **Fee rates** in `payment_fee_profiles` ship as placeholders (PayFast 2.90% +
  R2.00, Stripe 3.50% + R3.00) — finance must confirm against live contracts
  before launch.
