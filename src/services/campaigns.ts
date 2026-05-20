import type { TablesInsert, TablesUpdate } from "@/types/database";

type CampaignInsert = TablesInsert<"campaigns">;
type CampaignUpdate = TablesUpdate<"campaigns">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// Campaigns
// ────────────────────────────────────────────────────────────

export async function listCampaigns(
  supabase: Client,
  options?: { status?: string; limit?: number; offset?: number }
) {
  let query = supabase
    .from("campaigns")
    .select(
      "id, name, subject, status, scheduled_at, sent_at, created_at, label_id, labels(id, slug, name, color)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }
  return query;
}

export async function getCampaignById(supabase: Client, id: string) {
  return supabase
    .from("campaigns")
    .select(
      "*, labels(id, slug, name, color), sending_identities(id, slug, display_name, from_email, from_name, provider)"
    )
    .eq("id", id)
    .maybeSingle();
}

export async function createCampaign(supabase: Client, data: CampaignInsert) {
  return supabase.from("campaigns").insert(data).select().single();
}

export async function updateCampaign(
  supabase: Client,
  id: string,
  data: CampaignUpdate
) {
  return supabase
    .from("campaigns")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
}

export async function deleteCampaign(supabase: Client, id: string) {
  return supabase.from("campaigns").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// Audience + recipients
// ────────────────────────────────────────────────────────────

/** Contacts who would receive a campaign for the given label. */
export async function getCampaignAudience(supabase: Client, labelId: string) {
  return supabase
    .from("v_campaign_audience")
    .select("contact_id, email, email_normalized, first_name, last_name")
    .eq("label_id", labelId);
}

export async function getCampaignAudienceCount(supabase: Client, labelId: string) {
  const { count } = await supabase
    .from("v_campaign_audience")
    .select("contact_id", { count: "exact", head: true })
    .eq("label_id", labelId);
  return count ?? 0;
}

/** Per-recipient delivery rows for a sent campaign — drives analytics. */
export async function getCampaignRecipients(supabase: Client, campaignId: string) {
  return supabase
    .from("campaign_recipients")
    .select(
      "id, contact_id, sent_at, delivered_at, opened_at, first_clicked_at, bounced_at, complained_at, unsubscribed_at"
    )
    .eq("campaign_id", campaignId);
}

export type CampaignStats = {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
};

/** Aggregate delivery metrics for a campaign, via head-count queries. */
export async function getCampaignStats(
  supabase: Client,
  campaignId: string
): Promise<CampaignStats> {
  const base = () =>
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

  const [total, sent, delivered, opened, clicked, bounced, unsubscribed] =
    await Promise.all([
      base(),
      base().not("sent_at", "is", null),
      base().not("delivered_at", "is", null),
      base().not("opened_at", "is", null),
      base().not("first_clicked_at", "is", null),
      base().not("bounced_at", "is", null),
      base().not("unsubscribed_at", "is", null),
    ]);

  return {
    total: total.count ?? 0,
    sent: sent.count ?? 0,
    delivered: delivered.count ?? 0,
    opened: opened.count ?? 0,
    clicked: clicked.count ?? 0,
    bounced: bounced.count ?? 0,
    unsubscribed: unsubscribed.count ?? 0,
  };
}

// ────────────────────────────────────────────────────────────
// Sending identities
// ────────────────────────────────────────────────────────────

export async function listSendingIdentities(supabase: Client) {
  return supabase
    .from("sending_identities")
    .select("*")
    .eq("is_active", true)
    .order("display_name");
}
