import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignBatch } from "@/services/campaign-send";
import { getAuthedUser, canManageComms, COMMS_SEND_PERMS } from "@/lib/api-auth";

// One batch may take ~25s for 100 Mailtrap calls — allow headroom.
export const maxDuration = 60;

// POST /api/campaigns/[id]/send — sends ONE batch and reports remaining.
// The composer loops this until done; the cron drains scheduled sends.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageComms(supabase, user.id, COMMS_SEND_PERMS))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const result = await sendCampaignBatch(admin, id, 100);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 400 });
  }
  return NextResponse.json(result);
}
