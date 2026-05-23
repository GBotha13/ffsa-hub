import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { manualLinkPerson, unlinkPerson } from "@/services/records-library";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: personId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { user_id?: string; action?: "link" | "unlink" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "unlink") {
    const res = await unlinkPerson(supabase, personId);
    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (!body.user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  const res = await manualLinkPerson(supabase, personId, body.user_id);
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
