import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteTokens } from "@/services/xero";
import type { XeroRegion } from "@/services/xero";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const region: XeroRegion = body.region === "us" ? "us" : "za";

  const { error } = await deleteTokens(supabase, region);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
