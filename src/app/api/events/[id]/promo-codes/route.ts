import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPromoCode } from "@/services/ticketing";
import { getAuthedUser, canManageEvents } from "@/lib/api-auth";

// POST /api/events/[id]/promo-codes
// Body: { code, kind: 'percent'|'fixed_amount'|'comp',
//         percent_off?, amount_off_cents?, applies_to_ticket_type_id?,
//         max_redemptions?, valid_from?, valid_until?, is_active? }
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
  if (!(await canManageEvents(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    code?: string;
    kind?: "percent" | "fixed_amount" | "comp";
    percent_off?: number | null;
    amount_off_cents?: number | null;
    applies_to_ticket_type_id?: string | null;
    max_redemptions?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    is_active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.code?.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (!body.kind || !["percent", "fixed_amount", "comp"].includes(body.kind)) {
    return NextResponse.json(
      { error: "kind must be 'percent', 'fixed_amount' or 'comp'" },
      { status: 400 }
    );
  }

  // Kind-specific shape validation.
  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  if (body.kind === "percent") {
    if (
      typeof body.percent_off !== "number" ||
      body.percent_off <= 0 ||
      body.percent_off > 100
    ) {
      return NextResponse.json(
        { error: "percent_off must be 1-100 for kind='percent'" },
        { status: 400 }
      );
    }
    percentOff = Math.round(body.percent_off);
  } else if (body.kind === "fixed_amount") {
    if (
      typeof body.amount_off_cents !== "number" ||
      body.amount_off_cents <= 0
    ) {
      return NextResponse.json(
        { error: "amount_off_cents must be > 0 for kind='fixed_amount'" },
        { status: 400 }
      );
    }
    amountOffCents = Math.round(body.amount_off_cents);
  }
  // 'comp' takes neither — value is 100% off by definition.

  const { data, error } = await createPromoCode(supabase, {
    event_id: eventId,
    code: body.code.trim(),
    kind: body.kind,
    percent_off: percentOff,
    amount_off_cents: amountOffCents,
    applies_to_ticket_type_id: body.applies_to_ticket_type_id ?? null,
    max_redemptions: body.max_redemptions ?? null,
    valid_from: body.valid_from ?? null,
    valid_until: body.valid_until ?? null,
    is_active: body.is_active ?? true,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That code is already in use on this event." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ promoCode: data });
}
