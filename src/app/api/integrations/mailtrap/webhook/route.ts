import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/integrations/mailtrap/webhook — Mailtrap delivery events.
// Mailtrap posts { events: [ { event, message_id, email, ... } ] }.
// We reconcile against campaign_recipients.provider_message_id and
// update the matching timestamp column + the contact timeline.
export async function POST(request: Request) {
  const admin = createAdminClient();

  let body: { events?: MailtrapEvent[] } | MailtrapEvent[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const events: MailtrapEvent[] = Array.isArray(body) ? body : body.events ?? [];

  let handled = 0;
  for (const ev of events) {
    if (!ev?.message_id) continue;

    const { data: recipient } = await admin
      .from("campaign_recipients")
      .select("id, campaign_id, contact_id")
      .eq("provider_message_id", ev.message_id)
      .maybeSingle();
    if (!recipient) continue; // unknown message — ignore gracefully

    const at = ev.timestamp
      ? new Date(ev.timestamp * 1000).toISOString()
      : new Date().toISOString();

    const patch: Record<string, unknown> = {};
    let activityType: string | null = null;

    switch (ev.event) {
      case "delivery":
        patch.delivered_at = at;
        break;
      case "open":
        patch.opened_at = at;
        activityType = "email_opened";
        break;
      case "click":
        patch.first_clicked_at = at;
        activityType = "email_clicked";
        break;
      case "bounce":
      case "soft bounce":
      case "suspension":
        patch.bounced_at = at;
        patch.bounce_reason = ev.reason ?? ev.event;
        activityType = "email_bounced";
        break;
      case "spam":
        patch.complained_at = at;
        activityType = "email_complained";
        break;
      case "unsubscribe":
        patch.unsubscribed_at = at;
        activityType = "email_unsubscribed";
        break;
      default:
        continue;
    }

    await admin.from("campaign_recipients").update(patch).eq("id", recipient.id);

    // Opens/clicks/bounces/complaints go on the contact timeline.
    // Deliveries are skipped to avoid timeline noise.
    if (activityType && recipient.contact_id) {
      await admin.from("activity_events").insert({
        contact_id: recipient.contact_id,
        event_type: activityType,
        related_campaign_id: recipient.campaign_id,
        occurred_at: at,
      });
    }

    // Hard bounces + complaints feed the global suppression list.
    if ((ev.event === "bounce" || ev.event === "spam") && ev.email) {
      await admin
        .from("email_suppressions")
        .upsert(
          {
            email_normalized: ev.email.trim().toLowerCase(),
            reason: ev.event === "spam" ? "complaint" : "hard_bounce",
          },
          { onConflict: "email_normalized", ignoreDuplicates: true }
        );
    }

    handled++;
  }

  return NextResponse.json({ handled });
}

type MailtrapEvent = {
  event?: string;
  message_id?: string;
  email?: string;
  timestamp?: number;
  reason?: string;
};
