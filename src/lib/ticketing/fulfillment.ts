// FFSA Hub — Ticket fulfilment integration point.
//
// Called whenever an order transitions to `paid` (PayFast webhook,
// future Stripe webhook, future comp-code branch). The single
// shared entry point keeps the webhook + comp paths consistent.
//
// Today this is a stub — ticket 10 fills it in with:
//   - Generating unguessable codes
//   - Inserting tickets rows
//   - Sending the buyer the confirmation email via Resend (with
//     QR codes inline)
//   - Triggering CRM resolution (ticket 11)
//
// Webhook handlers must call this on paid orders; the no-op
// today means PayFast confirmations get accepted but no ticket
// rows or emails are produced until ticket 10 ships.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/**
 * Issue tickets for an order that has just transitioned to `paid`.
 * Idempotent: safe to call more than once for the same order — ticket
 * 10 will guard via the orders.tickets relationship.
 */
export async function fulfillOrder(
  _supabase: Client,
  _orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // TODO(ticket 10): implement.
  // For now we acknowledge but do nothing — the order is marked paid
  // by the caller, the buyer has been redirected back to the thanks
  // page, but no tickets exist and no email goes out.
  return { ok: true };
}
