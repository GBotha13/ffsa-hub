import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lightweight code check used by /join/[code] before showing the form.
// Returns { valid: boolean } only — no other settings leak to the public.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminSupabase as any)
    .from("public_signup_settings")
    .select("code, enabled")
    .eq("id", 1)
    .single();

  const valid = !!data && data.code === code && data.enabled === true;
  return NextResponse.json({ valid });
}
