import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenSlots } from "@/services/prayer-room";

// GET — coverage feed: open (unfilled) slots across a week. v1 returns the raw
// rows; the coverage UI (grouping "these sets still need a bassist") lands in v2.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const weekStart = new URL(request.url).searchParams.get("weekStart");
  if (!weekStart) return NextResponse.json({ error: "weekStart (YYYY-MM-DD) is required" }, { status: 400 });

  const { data, error } = await getOpenSlots(supabase, weekStart);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
