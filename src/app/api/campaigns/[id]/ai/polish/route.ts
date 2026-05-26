import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/services/campaigns";
import { polishBlockText } from "@/lib/ai/campaign-ai";
import {
  getAuthedUser,
  hasAnyRole,
  COMMS_MANAGE_ROLES,
} from "@/lib/api-auth";

// POST /api/campaigns/[id]/ai/polish
// Body: { html: string }
// Returns: { polished: string }
//
// Polishes a single text block's HTML for editorial tone, preserving
// meaning, length, and any <strong>/<em>/<a> tags.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, COMMS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Confirm campaign exists (and gates access via RLS).
  const { data: campaign } = await getCampaignById(supabase, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body: { html?: string };
  try {
    body = (await request.json()) as { html?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.html !== "string") {
    return NextResponse.json({ error: "html is required" }, { status: 400 });
  }

  try {
    const result = await polishBlockText({
      html: body.html,
      context: campaign.subject ?? undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Polish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
