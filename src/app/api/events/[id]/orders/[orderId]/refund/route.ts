import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, canManageEvents } from "@/lib/api-auth";
import { logActivity } from "@/services/activity-events";

type OrderLine = {
  ticket_type_id: string;
  qty: number;
};

// POST /api/events/[id]/orders/[orderId]/refund
//
// Records a refund in FFSA Hub: marks the order refunded, voids
// its tickets, releases inventory back to the tier, and writes a
// ticket_refunded activity event on the buyer's contact (if
// resolved). Staff must process the actual money refund in PayFast
// separately — this matches the v1 "staff-processed only" decision
// (no provider refund API call).
//
// Idempotent via the `eq("status", "paid")` guard on the update —
// re-clicking refund on an already-refunded order is a no-op.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; orderId: string }> }
) {
  const { orderId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await canManageEvents(supabase, user.id, ["events.manage_registrations"]))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, status, total_cents, lines, buyer_contact_id, event_id"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      {
        error: `Order is ${order.status} — only paid orders can be refunded here.`,
      },
      { status: 409 }
    );
  }

  // Mark refunded (idempotent guard).
  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_cents: order.total_cents,
    })
    .eq("id", orderId)
    .eq("status", "paid");
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Void tickets so the door scanner rejects them.
  await supabase
    .from("tickets")
    .update({ status: "void" })
    .eq("order_id", orderId);

  // Release inventory per line (lines is JSONB from migration 059).
  const lines = (order.lines as OrderLine[] | null) ?? [];
  for (const line of lines) {
    await supabase.rpc("release_ticket_inventory", {
      p_ticket_type_id: line.ticket_type_id,
      p_qty: line.qty,
    });
  }

  // Timeline entry on the buyer's contact (if CRM resolution
  // already linked one). If they're still in the review queue,
  // staff resolution will pick up the refunded state later.
  if (order.buyer_contact_id) {
    await logActivity(supabase, {
      contact_id: order.buyer_contact_id,
      event_type: "ticket_refunded",
      related_user_id: user.id,
      payload: {
        order_id: orderId,
        event_id: order.event_id,
        refund_cents: order.total_cents,
      },
    });
  }

  return NextResponse.json({ refunded: true });
}
