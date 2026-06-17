import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWeek } from "@/services/prayer-room";

// POST — coordinator generates this week's sets from the active template.
// The DB function enforces staff-only and is idempotent.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const weekStart = (body as { weekStart?: string }).weekStart;
  if (!weekStart) return NextResponse.json({ error: "weekStart (YYYY-MM-DD) is required" }, { status: 400 });

  const { data, error } = await ensureWeek(supabase, weekStart);
  if (error) {
    const status = /staff/i.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ created: data ?? 0 });
}
