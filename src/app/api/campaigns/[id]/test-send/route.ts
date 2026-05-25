import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/services/campaigns";
import { getEffectiveBrand } from "@/services/brand";
import { renderCampaignHtml, type CampaignBody } from "@/lib/campaigns/blocks";
import { sendViaMailtrap } from "@/lib/email/mailtrap";
import {
  getAuthedUser,
  hasAnyRole,
  COMMS_MANAGE_ROLES,
} from "@/lib/api-auth";

// POST /api/campaigns/[id]/test-send
// Body: { to: string }
//
// Renders the campaign through the same renderer used for real sends,
// including the brand kit attached to the campaign's sending identity.
// Subject is prefixed with [TEST] so the recipient can tell at a glance.
// No campaign_recipients row is written — this never counts toward
// analytics or campaign state.
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

  let body: { to?: string };
  try {
    body = (await request.json()) as { to?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = (body.to ?? user.email ?? "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: "Provide a valid email address" },
      { status: 400 }
    );
  }

  const { data: campaign, error } = await getCampaignById(supabase, id);
  if (error || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!campaign.sending_identities) {
    return NextResponse.json(
      { error: "Campaign has no sending identity" },
      { status: 400 }
    );
  }
  if (!campaign.subject?.trim()) {
    return NextResponse.json(
      { error: "Add a subject before sending a test" },
      { status: 400 }
    );
  }
  const source = campaign.body_source as unknown as CampaignBody | null;
  if (!source || !source.blocks?.length) {
    return NextResponse.json(
      { error: "Add at least one content block first" },
      { status: 400 }
    );
  }

  const brand = await getEffectiveBrand(supabase, campaign.sending_identity_id);
  const html = renderCampaignHtml(source, {
    previewText: campaign.preview_text ?? undefined,
    brand,
    // No per-recipient compliance footer for tests — there's no contact row.
    // The brand footer still renders.
  });

  const identity = campaign.sending_identities as {
    from_email: string;
    from_name: string;
    reply_to: string | null;
  };

  const result = await sendViaMailtrap({
    fromEmail: identity.from_email,
    fromName: identity.from_name,
    replyTo: identity.reply_to,
    to,
    subject: `[TEST] ${campaign.subject}`,
    html,
    category: `campaign-test:${id}`,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId, to });
}
