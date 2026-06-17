import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyLatestApplication } from "@/services/prayer-room-applications";

// GET — the caller's latest application (status + desired skills).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await getMyLatestApplication(supabase, user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
