import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getXeroConnectionStatus } from "@/services/xero";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Returns status for both regions
  const status = await getXeroConnectionStatus(supabase);
  return NextResponse.json(status);
}
