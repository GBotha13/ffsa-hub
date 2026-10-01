import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelPractice } from "@/services/prayer-room-practice";
import { practiceErrorMessage } from "@/lib/prayer-room/practice";

// DELETE — cancel a practice booking. Your own, or anyone's if you are staff;
// practice_cancel() decides. No cut-off (handoff 17, rule 11).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { error } = await cancelPractice(supabase, id);
  if (error) return NextResponse.json({ error: practiceErrorMessage(error) }, { status: 403 });
  return NextResponse.json({ ok: true });
}
