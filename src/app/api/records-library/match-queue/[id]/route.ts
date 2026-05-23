import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveMatch, rejectMatch } from "@/services/records-library";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { action?: "approve" | "reject"; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  // RPCs themselves enforce is_admin OR records_library.manage.
  const res =
    body.action === "approve"
      ? await approveMatch(supabase, id, body.notes)
      : await rejectMatch(supabase, id, body.notes);

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
