import { renderCampaignHtml, type CampaignBody } from "@/lib/campaigns/blocks";
import { sendViaMailtrap } from "@/lib/email/mailtrap";
import { signUnsubscribeToken } from "@/lib/tokens/unsubscribe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.ffsahub.com";

export type BatchResult = {
  ok: boolean;
  error?: string;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
};

function footerHtml(args: {
  contactId: string;
  labelId: string | null;
  labelName: string;
}): string {
  const token = signUnsubscribeToken(args.contactId, args.labelId);
  const url = `${APP_URL}/unsubscribe?t=${encodeURIComponent(token)}`;
  return `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="padding:18px 36px;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
You're receiving this because you're subscribed to <strong>${args.labelName}</strong>.<br/>
<a href="${url}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> &middot; Fire &amp; Fragrance South Africa
</td></tr></table>`;
}

/**
 * Send one batch of a campaign. Idempotent + resumable: a contact who
 * already has a campaign_recipients row is skipped, so calling this
 * repeatedly drains the audience. Flips status sending → sent when done.
 *
 * Always called with a service-role admin client.
 */
export async function sendCampaignBatch(
  supabase: Client,
  campaignId: string,
  batchSize = 100
): Promise<BatchResult> {
  const base: BatchResult = {
    ok: true,
    sent: 0,
    failed: 0,
    remaining: 0,
    done: false,
  };

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select(
      "*, labels(id, name), sending_identities(from_email, from_name, reply_to)"
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (cErr || !campaign) return { ...base, ok: false, error: "Campaign not found" };

  if (campaign.status === "sent") return { ...base, done: true };
  if (campaign.status === "cancelled" || campaign.status === "failed") {
    return { ...base, ok: false, error: `Campaign is ${campaign.status}` };
  }
  if (!campaign.subject?.trim()) {
    return { ...base, ok: false, error: "Campaign has no subject" };
  }
  if (!campaign.label_id || !campaign.sending_identities) {
    return { ...base, ok: false, error: "Campaign is missing audience or sender" };
  }

  // Flip to 'sending' on the first batch.
  if (campaign.status !== "sending") {
    await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaignId);
  }

  // Audience minus already-processed recipients.
  const [{ data: audience }, { data: doneRows }] = await Promise.all([
    supabase
      .from("v_campaign_audience")
      .select("contact_id, email")
      .eq("label_id", campaign.label_id),
    supabase
      .from("campaign_recipients")
      .select("contact_id")
      .eq("campaign_id", campaignId),
  ]);

  const done = new Set((doneRows ?? []).map((r: { contact_id: string }) => r.contact_id));
  const pending = (audience ?? []).filter(
    (a: { contact_id: string }) => !done.has(a.contact_id)
  );

  if (pending.length === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { ...base, done: true };
  }

  const batch = pending.slice(0, batchSize);
  const body = campaign.body_source as unknown as CampaignBody;
  const fromEmail = campaign.sending_identities.from_email;
  const fromName = campaign.sending_identities.from_name;
  const replyTo = campaign.sending_identities.reply_to;
  const labelName = campaign.labels?.name ?? "our updates";

  let sent = 0;
  let failed = 0;

  for (const recipient of batch as { contact_id: string; email: string }[]) {
    const html = renderCampaignHtml(body, {
      previewText: campaign.preview_text ?? undefined,
      footerHtml: footerHtml({
        contactId: recipient.contact_id,
        labelId: campaign.label_id,
        labelName,
      }),
    });

    const result = await sendViaMailtrap({
      fromEmail,
      fromName,
      replyTo,
      to: recipient.email,
      subject: campaign.subject,
      html,
      category: `campaign:${campaignId}`,
    });

    const nowIso = new Date().toISOString();
    if (result.error) {
      failed++;
      await supabase.from("campaign_recipients").insert({
        campaign_id: campaignId,
        contact_id: recipient.contact_id,
        bounce_reason: result.error.slice(0, 300),
      });
    } else {
      sent++;
      await supabase.from("campaign_recipients").insert({
        campaign_id: campaignId,
        contact_id: recipient.contact_id,
        provider_message_id: result.messageId,
        sent_at: nowIso,
      });
      await supabase.from("activity_events").insert({
        contact_id: recipient.contact_id,
        event_type: "email_sent",
        related_campaign_id: campaignId,
        occurred_at: nowIso,
      });
    }
  }

  const remaining = pending.length - batch.length;
  if (remaining === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  return {
    ok: true,
    sent,
    failed,
    remaining,
    done: remaining === 0,
  };
}
