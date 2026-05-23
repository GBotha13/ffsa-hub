import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payfastProvider } from "@/lib/payments/payfast";
import { fulfillOrder } from "@/lib/ticketing/fulfillment";

// POST /api/integrations/payfast/notify
//
// PayFast posts here server-to-server after a buyer pays (or
// cancels) on its hosted page. The webhook is the source of truth
// for an order's payment status — never the buyer's return URL.
//
// Verification: payfastProvider.verifyWebhook checks the ITN
// signature AND postbacks the payload to PayFast for confirmation.
// Either failure throws.
//
// Behaviour:
//  - signature/postback fail → log + return 200 (PayFast doesn't
//    act on response codes; we just don't fulfil).
//  - status = paid → markOrderPaid (idempotent via the eq("status",
//    "pending") guard); on first transition, call fulfillOrder.
//  - status = cancelled/failed → cancel the pending order and
//    release its inventory hold.

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = request.headers;
  const sourceIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;

  let result;
  try {
    result = await payfastProvider.verifyWebhook({
      rawBody,
      headers,
      sourceIp,
    });
  } catch (e) {
    // Verification failed — bad signature, failed postback, or
    // missing m_payment_id. Log and ack so PayFast doesn't retry
    // into the void; do NOT fulfil.
    console.error(
      "[payfast/notify] verification failed:",
      e instanceof Error ? e.message : e
    );
    return new NextResponse("ok", { status: 200 });
  }

  const supabase = createAdminClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status, total_cents, event_id")
    .eq("id", result.orderId)
    .maybeSingle();
  if (orderErr || !order) {
    console.error(
      "[payfast/notify] order not found:",
      result.orderId,
      orderErr?.message
    );
    return new NextResponse("ok", { status: 200 });
  }

  // Defense-in-depth: PayFast posts amount_gross — compare to what
  // we expect on the order. A mismatch means someone is messing
  // with the redirect / posting forged ITNs that pass signature
  // (highly unlikely with passphrase, but cheap to check).
  if (
    result.amountCents != null &&
    Math.abs(result.amountCents - order.total_cents) > 0
  ) {
    console.error(
      "[payfast/notify] amount mismatch for order",
      order.id,
      "expected",
      order.total_cents,
      "got",
      result.amountCents
    );
    return new NextResponse("ok", { status: 200 });
  }

  if (result.status === "paid") {
    // Idempotent: only flips pending → paid. Replayed webhooks land
    // here with status already paid; maybeSingle returns null data,
    // we treat it as already-handled and skip fulfilment.
    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        provider_payment_id: result.providerPaymentId,
      })
      .eq("id", order.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateErr) {
      console.error(
        "[payfast/notify] mark-paid failed for order",
        order.id,
        updateErr.message
      );
      return new NextResponse("ok", { status: 200 });
    }
    if (updated) {
      // First transition to paid — fire fulfilment. Ticket 10 fills
      // in the real implementation (issue tickets + send email +
      // trigger CRM resolution).
      const fulfilment = await fulfillOrder(supabase, order.id);
      if (!fulfilment.ok) {
        console.error(
          "[payfast/notify] fulfilment failed for order",
          order.id,
          fulfilment.error
        );
        // Don't surface to PayFast — the order is paid; staff handles
        // the fulfilment failure out-of-band.
      }
    }
  } else if (result.status === "cancelled" || result.status === "failed") {
    // Cancel + release inventory only if the order is still pending
    // (don't reverse a paid order on a stray late ITN).
    const { data: pending } = await supabase
      .from("orders")
      .select("id")
      .eq("id", order.id)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) {
      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");
      // Release inventory for each line on the order. We don't store
      // line items as a separate table in v1 — but we DO need to
      // know what to release. For v1 we leave the inventory held;
      // expires_at + a cron sweep (later) handles cleanup. A future
      // line-items table makes the release exact.
    }
  }
  // status === "pending" → no-op (PayFast confirming receipt).

  return new NextResponse("ok", { status: 200 });
}
