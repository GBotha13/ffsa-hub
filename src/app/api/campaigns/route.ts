import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCampaign, setCampaignLabels } from "@/services/campaigns";
import { emptyCampaignBody, renderCampaignHtml } from "@/lib/campaigns/blocks";
import { getAuthedUser, hasAnyRole, COMMS_MANAGE_ROLES } from "@/lib/api-auth";
import type { Json, TablesInsert } from "@/types/database";

// POST /api/campaigns — create a draft campaign.
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, COMMS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { name?: string; labelIds?: string[]; sendingIdentityId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Array.isArray(body.labelIds) || body.labelIds.length === 0) {
    return NextResponse.json(
      { error: "labelIds (at least one) is required" },
      { status: 400 }
    );
  }
  if (!body.sendingIdentityId) {
    return NextResponse.json(
      { error: "sendingIdentityId is required" },
      { status: 400 }
    );
  }

  const emptyBody = emptyCampaignBody();
  // label_id was dropped by migration 051 — the cast covers the stale type
  // until `supabase gen types` is re-run.
  const { data, error } = await createCampaign(supabase, {
    name: body.name.trim(),
    subject: "",
    body_source: emptyBody as unknown as Json,
    body_html: renderCampaignHtml(emptyBody, {}),
    sending_identity_id: body.sendingIdentityId,
    status: "draft",
    created_by: user.id,
  } as unknown as TablesInsert<"campaigns">);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create campaign" },
      { status: 500 }
    );
  }

  const setRes = await setCampaignLabels(supabase, data.id, body.labelIds);
  if (setRes.error) {
    return NextResponse.json({ error: setRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
