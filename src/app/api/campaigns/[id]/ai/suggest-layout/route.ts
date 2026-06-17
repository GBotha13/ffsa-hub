import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/services/campaigns";
import { suggestLayout } from "@/lib/ai/campaign-ai";
import {
  type CampaignBody,
} from "@/lib/campaigns/blocks";
import { getAuthedUser, canManageComms } from "@/lib/api-auth";

// POST /api/campaigns/[id]/ai/suggest-layout
// Body: { body?: CampaignBody }  (optional — falls back to saved campaign body)
// Returns: { body: CampaignBody, warnings: string[] }
//
// Takes the current campaign body and asks Claude to re-block it into a
// more compelling editorial layout. Doesn't mutate the saved campaign —
// the client previews the suggestion and chooses whether to apply.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageComms(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: campaign } = await getCampaignById(supabase, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let inputBody: { body?: CampaignBody } = {};
  try {
    inputBody = (await request.json().catch(() => ({}))) as {
      body?: CampaignBody;
    };
  } catch {
    // body is optional; ignore parse errors
  }

  const source: CampaignBody | null =
    inputBody.body && Array.isArray(inputBody.body.blocks)
      ? inputBody.body
      : (campaign.body_source as unknown as CampaignBody | null);

  if (!source || !source.blocks?.length) {
    return NextResponse.json(
      { error: "Add at least one content block before asking for a layout suggestion" },
      { status: 400 }
    );
  }

  try {
    const result = await suggestLayout({
      body: source,
      subject: campaign.subject ?? undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Layout suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
