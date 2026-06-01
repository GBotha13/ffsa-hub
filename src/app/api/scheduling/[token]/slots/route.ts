import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitProposedSlots } from "@/services/scheduling";

// Public — magic-token gated only. The token's randomness is the auth.
export async function PUT(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    slots?: Array<{ starts_at: string; ends_at: string }>;
  };

  if (!Array.isArray(body.slots)) {
    return NextResponse.json({ error: "slots[] is required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const result = await submitProposedSlots(adminSupabase, token, body.slots);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, count: result.count });
}
