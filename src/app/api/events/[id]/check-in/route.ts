import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthedUser,
  hasAnyRole,
  EVENTS_MANAGE_ROLES,
} from "@/lib/api-auth";
import { logActivity } from "@/services/activity-events";

// POST /api/events/[id]/check-in
// Body: { code: string }
//
// Validates the scanned/typed code against this event's tickets,
// and on a successful match flips status valid -> checked_in
// (optimistic guard on status='valid' makes this idempotent for
// concurrent scans). Returns a discriminated result the scanner
// UI renders colour-coded.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, status, event_id, checked_in_at, ticket_types(name), orders(buyer_first_name, buyer_last_name, buyer_contact_id)"
    )
    .eq("code", code)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ result: "invalid" });
  }
  if (ticket.event_id !== eventId) {
    return NextResponse.json({ result: "wrong_event" });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ticketTypeName = (ticket.ticket_types as any)?.name ?? "Ticket";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buyerOrder = ticket.orders as any;

  if (ticket.status === "void") {
    return NextResponse.json({ result: "void" });
  }
  if (ticket.status === "checked_in") {
    return NextResponse.json({
      result: "already_checked_in",
      ticketTypeName,
      checkedInAt: ticket.checked_in_at,
    });
  }

  // Flip to checked_in — optimistic guard handles concurrent scans.
  const { data: updated, error: updateErr } = await supabase
    .from("tickets")
    .update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      checked_in_by: user.id,
    })
    .eq("id", ticket.id)
    .eq("status", "valid")
    .select("id")
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  if (!updated) {
    // Race: another door scanner beat us to it.
    return NextResponse.json({
      result: "already_checked_in",
      ticketTypeName,
      checkedInAt: new Date().toISOString(),
    });
  }

  // Best-effort timeline entry on the buyer's contact (if resolved).
  if (buyerOrder?.buyer_contact_id) {
    await logActivity(supabase, {
      contact_id: buyerOrder.buyer_contact_id,
      event_type: "ticket_checked_in",
      related_user_id: user.id,
      payload: { ticket_id: ticket.id, event_id: eventId },
    });
  }

  const buyerName = buyerOrder
    ? `${buyerOrder.buyer_first_name} ${buyerOrder.buyer_last_name}`
    : "";

  return NextResponse.json({
    result: "ok",
    ticketTypeName,
    buyerName,
  });
}
