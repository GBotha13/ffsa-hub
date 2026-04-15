import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSeries,
  createSeries,
  approveSeries,
  rejectSeries,
  cancelSeries,
} from "@/services/prayer-room";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const userId = url.searchParams.get("userId") ?? undefined;

  const { data, error } = await getSeries(supabase, { status, userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();

  const { commitment_type, title, day_of_week, start_time, end_time, start_date, end_date } = body;

  if (!commitment_type || !start_time || !end_time || !start_date) {
    return NextResponse.json(
      { error: "commitment_type, start_time, end_time, and start_date are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createSeries(supabase, {
    created_by: user.id,
    commitment_type,
    title: title ?? undefined,
    day_of_week: day_of_week ?? undefined,
    start_time,
    end_time,
    start_date,
    end_date: end_date ?? undefined,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, action, rejection_reason } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  if (action === "approve") {
    const { data, error } = await approveSeries(supabase, id, user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "reject") {
    const { data, error } = await rejectSeries(supabase, id, user.id, rejection_reason);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "cancel") {
    await cancelSeries(supabase, id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
