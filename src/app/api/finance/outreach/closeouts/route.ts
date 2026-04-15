import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  upsertCloseout,
  updateCloseoutStatus,
} from "@/services/outreach-finance";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  if (
    !body.team_id ||
    body.total_funds_sent == null ||
    body.total_spent == null ||
    body.cash_remaining == null ||
    body.funds_returned == null
  ) {
    return NextResponse.json(
      {
        error:
          "team_id, total_funds_sent, total_spent, cash_remaining, and funds_returned are required",
      },
      { status: 400 }
    );
  }

  const totalFundsSent = Number(body.total_funds_sent);
  const totalSpent = Number(body.total_spent);
  const cashRemaining = Number(body.cash_remaining);
  const fundsReturned = Number(body.funds_returned);

  const variance =
    totalFundsSent - totalSpent - cashRemaining - fundsReturned;
  const variancePct =
    totalFundsSent > 0 ? (variance / totalFundsSent) * 100 : 0;

  const autoClose = Math.abs(variancePct) <= 2;

  const { data, error } = await upsertCloseout(supabase, {
    team_id: body.team_id,
    total_funds_sent: totalFundsSent,
    total_spent: totalSpent,
    cash_remaining: cashRemaining,
    funds_returned: fundsReturned,
    variance,
    variance_pct: Math.round(variancePct * 100) / 100,
    status: autoClose ? "auto_closed" : "pending",
    admin_notes: body.admin_notes ?? null,
    closed_by: autoClose ? user.id : null,
    closed_at: autoClose ? new Date().toISOString() : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.team_id || !body.status) {
    return NextResponse.json(
      { error: "team_id and status are required" },
      { status: 400 }
    );
  }

  if (!["admin_override", "rejected", "pending"].includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  const isClosed =
    body.status === "admin_override" || body.status === "rejected";

  const { data, error } = await updateCloseoutStatus(supabase, body.team_id, {
    status: body.status,
    admin_notes: body.admin_notes ?? null,
    closed_by: isClosed ? user.id : null,
    closed_at: isClosed ? new Date().toISOString() : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
