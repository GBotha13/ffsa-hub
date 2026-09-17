import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addUserToBaseCalendar } from "@/lib/google/calendar";

// Admin-only endpoint: immediately share the FFSA base calendar with any email.
// Used for manual backfills and testing without re-running onboarding.

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  await addUserToBaseCalendar(email);
  return NextResponse.json({ success: true });
}
