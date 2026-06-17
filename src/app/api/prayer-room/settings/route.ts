import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings, updateSettings } from "@/services/prayer-room";

// GET — prayer room settings (window + default block length).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await getSettings(supabase);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT — update settings (RLS: staff only).
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const fields: Record<string, unknown> = {};
  for (const k of ["window_start", "window_end", "default_block_minutes"]) {
    if (k in body) fields[k] = body[k];
  }
  const { data, error } = await updateSettings(supabase, fields);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data);
}
