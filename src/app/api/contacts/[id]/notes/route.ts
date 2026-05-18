import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logNoteAdded } from "@/services/activity-events";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: contactId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.note || !body.note.trim()) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const result = await logNoteAdded(supabase, {
    contactId,
    note: body.note.trim(),
    userId: user.id,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
