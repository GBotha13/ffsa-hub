import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertTeamBudget, deleteTeamBudget } from "@/services/outreach-finance";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { team_id, category_id, budget_amount_zar } = body;

  if (!team_id || !category_id || budget_amount_zar === undefined) {
    return NextResponse.json(
      { error: "team_id, category_id, and budget_amount_zar are required" },
      { status: 400 }
    );
  }

  const { data, error } = await upsertTeamBudget(supabase, {
    team_id,
    category_id,
    budget_amount_zar: Number(budget_amount_zar),
    people_count: body.people_count != null ? Number(body.people_count) : null,
    notes: body.notes || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, budget: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await deleteTeamBudget(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
