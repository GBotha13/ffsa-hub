import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updatePromoCode, deletePromoCode } from "@/services/ticketing";
import { getAuthedUser, canManageEvents } from "@/lib/api-auth";

// PATCH /api/events/[id]/promo-codes/[promoCodeId]
// Partial update. Does NOT allow changing `kind` — delete + recreate
// if you need to flip discount type.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; promoCodeId: string }> }
) {
  const { promoCodeId } = await context.params;
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

  const patch: Record<string, unknown> = {};
  if (body.code !== undefined) {
    if (!body.code.trim()) {
      return NextResponse.json({ error: "code cannot be empty" }, { status: 400 });
    }
    patch.code = body.code.trim();
  }
  if (body.percent_off !== undefined) {
    if (
      body.percent_off !== null &&
      (typeof body.percent_off !== "number" ||
        body.percent_off <= 0 ||
        body.percent_off > 100)
    ) {
      return NextResponse.json(
        { error: "percent_off must be 1-100 or null" },
        { status: 400 }
      );
    }
    patch.percent_off = body.percent_off;
  }
  if (body.amount_off_cents !== undefined) {
    if (
      body.amount_off_cents !== null &&
      (typeof body.amount_off_cents !== "number" || body.amount_off_cents <= 0)
    ) {
      return NextResponse.json(
        { error: "amount_off_cents must be > 0 or null" },
        { status: 400 }
      );
    }
    patch.amount_off_cents = body.amount_off_cents;
  }
  if (body.applies_to_ticket_type_id !== undefined) {
    patch.applies_to_ticket_type_id = body.applies_to_ticket_type_id;
  }
  if (body.max_redemptions !== undefined) patch.max_redemptions = body.max_redemptions;
  if (body.valid_from !== undefined) patch.valid_from = body.valid_from;
  if (body.valid_until !== undefined) patch.valid_until = body.valid_until;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await updatePromoCode(supabase, promoCodeId, patch);
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

// DELETE /api/events/[id]/promo-codes/[promoCodeId]
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; promoCodeId: string }> }
) {
  const { promoCodeId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await canManageEvents(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await deletePromoCode(supabase, promoCodeId);
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Can't delete a code that's been redeemed on an order. Deactivate it instead." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
