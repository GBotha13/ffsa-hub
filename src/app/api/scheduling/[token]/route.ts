import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchedulingRequestByToken } from "@/services/scheduling";

// Public — no auth check beyond the magic token.
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const adminSupabase = createAdminClient();
  const view = await getSchedulingRequestByToken(adminSupabase, token);
  if (!view) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }
  return NextResponse.json({ view });
}
