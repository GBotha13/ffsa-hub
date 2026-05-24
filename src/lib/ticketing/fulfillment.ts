// FFSA Hub — Ticket fulfilment.
//
// Called whenever an order transitions to `paid` (PayFast webhook
// today, Stripe in v1.5, future comp-code branch). One shared
// entry point keeps every path consistent.
//
// Steps:
//   1. Load the order (+ event, + existing tickets for idempotency).
//   2. If no tickets yet, generate codes from order.lines and bulk
//      insert into the tickets table.
//   3. Generate QR codes (data URIs) for each ticket.
//   4. Send the confirmation email via Resend (transactional).
//
// Idempotent: safe to invoke more than once for the same order —
// the tickets-by-order lookup short-circuits re-issuance, and the
// email re-sends (acceptable for retries).

import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { sendViaMailtrap } from "@/lib/email/mailtrap";
import { ticketConfirmationEmailHtml } from "@/lib/email/templates/ticket-confirmation";
import { resolveOrderToCrm } from "./crm-resolution";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

type OrderLine = {
  ticket_type_id: string;
  qty: number;
  per_ticket_cents: number;
};

// 8 bytes of randomness → ~11 chars base64url. ~10^19 keyspace —
// effectively zero collision risk even at millions of tickets.
function generateTicketCode(): string {
  return randomBytes(8).toString("base64url");
}

function formatEventDate(start: string, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const startD = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts);
  if (end && end !== start) {
    const endD = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts);
    return `${startD} – ${endD}`;
  }
  return startD;
}

export async function fulfillOrder(
  supabase: Client,
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Load order + event.
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, status, total_cents, buyer_first_name, buyer_last_name, buyer_email, lines, event_id, events(id, title, start_date, end_date, location, public_slug)"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) {
    return { ok: false, error: `Order ${orderId} not found` };
  }
  if (order.status !== "paid") {
    return {
      ok: false,
      error: `Order ${orderId} is not paid (status: ${order.status})`,
    };
  }
  if (!order.events) {
    return { ok: false, error: `Order ${orderId} has no event` };
  }

  // 2. Idempotency: if tickets already exist for this order, skip
  //    issuance and just resend the email.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tickets: any[];
  {
    const { data: existing } = await supabase
      .from("tickets")
      .select("id, code, ticket_type_id, ticket_types(name)")
      .eq("order_id", orderId)
      .order("created_at");
    tickets = existing ?? [];
  }

  if (tickets.length === 0) {
    const lines = (order.lines as OrderLine[]) ?? [];
    if (lines.length === 0) {
      return { ok: false, error: `Order ${orderId} has no lines to fulfil` };
    }
    const ticketRows = lines.flatMap((line) =>
      Array.from({ length: line.qty }, () => ({
        order_id: orderId,
        event_id: order.event_id,
        ticket_type_id: line.ticket_type_id,
        code: generateTicketCode(),
      }))
    );
    const { data: inserted, error: insertErr } = await supabase
      .from("tickets")
      .insert(ticketRows)
      .select("id, code, ticket_type_id, ticket_types(name)");
    if (insertErr || !inserted) {
      return {
        ok: false,
        error: `Failed to issue tickets: ${insertErr?.message ?? "unknown"}`,
      };
    }
    tickets = inserted;
  }

  // 3. Generate QR codes (one per ticket, inline data URI).
  const ticketsWithQr = await Promise.all(
    tickets.map(async (t) => ({
      code: t.code,
      tierName: t.ticket_types?.name ?? "Ticket",
      qrDataUrl: await QRCode.toDataURL(t.code, { width: 220, margin: 1 }),
    }))
  );

  // 4. Send confirmation email via Mailtrap.
  // sendViaMailtrap doesn't throw — returns { messageId, error } so we
  // just check error and log; tickets are already issued either way.
  if (!process.env.MAILTRAP_API_TOKEN) {
    console.warn(
      "[fulfillment] MAILTRAP_API_TOKEN not set; tickets issued without sending email"
    );
    return { ok: true };
  }
  const fromEmail =
    process.env.MAILTRAP_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    "noreply@ffsahub.com";
  const sendResult = await sendViaMailtrap({
    fromEmail,
    fromName: "Fire & Fragrance SA",
    to: order.buyer_email,
    subject: `Your tickets for ${order.events.title}`,
    html: ticketConfirmationEmailHtml({
      buyerFirstName: order.buyer_first_name,
      eventTitle: order.events.title,
      eventDate: formatEventDate(
        order.events.start_date,
        order.events.end_date
      ),
      eventLocation: order.events.location,
      tickets: ticketsWithQr,
      orderId: orderId,
      totalCents: order.total_cents,
    }),
    category: "ticket_confirmation",
  });
  if (sendResult.error) {
    console.error(
      "[fulfillment] failed to send confirmation email:",
      sendResult.error
    );
    // Tickets are issued — staff can resend the email from the admin
    // orders view. Don't fail fulfilment for an email-only issue.
  }

  // 5. CRM resolution (async-spirit: never fails fulfilment).
  // Routes the buyer through the existing dedup pipeline, links the
  // contact to the order, creates the event_registration, applies
  // the consent label, writes the timeline entry. Dedup conflicts
  // land in the existing review queue and resolve later.
  try {
    const crm = await resolveOrderToCrm(supabase, orderId);
    if (!crm.ok) {
      console.error(
        "[fulfillment] CRM resolution returned error (non-blocking):",
        crm.error
      );
    }
  } catch (e) {
    console.error("[fulfillment] CRM resolution threw (non-blocking):", e);
  }

  return { ok: true };
}
