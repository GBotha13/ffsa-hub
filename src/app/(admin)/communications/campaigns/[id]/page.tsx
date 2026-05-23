import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getCampaignById,
  getCampaignAudienceCount,
  getCampaignStats,
  getCampaignLabelIds,
  listSendingIdentities,
} from "@/services/campaigns";
import { getLabels } from "@/services/labels";
import { emptyCampaignBody, type CampaignBody } from "@/lib/campaigns/blocks";
import { CampaignComposer } from "./campaign-composer";
import { CampaignAnalytics } from "./campaign-analytics";

export default async function CampaignComposerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign, error } = await getCampaignById(supabase, id);
  if (error || !campaign) notFound();

  const [{ data: labels }, { data: identities }, audienceCount, labelIds] =
    await Promise.all([
      getLabels(supabase, { active: true }),
      listSendingIdentities(supabase),
      getCampaignAudienceCount(supabase, id),
      getCampaignLabelIds(supabase, id),
    ]);

  const body: CampaignBody =
    campaign.body_source &&
    typeof campaign.body_source === "object" &&
    "blocks" in campaign.body_source
      ? (campaign.body_source as unknown as CampaignBody)
      : emptyCampaignBody();

  const showStats =
    campaign.status === "sent" || campaign.status === "sending";
  const stats = showStats ? await getCampaignStats(supabase, id) : null;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/communications"
          className="text-xs text-muted-foreground hover:text-foreground uppercase"
          style={{ letterSpacing: "0.15em" }}
        >
          ← Communications
        </Link>
      </div>
      {stats && <CampaignAnalytics stats={stats} />}
      <CampaignComposer
        campaign={{
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject ?? "",
          preview_text: campaign.preview_text ?? "",
          label_ids: labelIds,
          sending_identity_id: campaign.sending_identity_id,
          status: campaign.status,
          scheduled_at: campaign.scheduled_at,
        }}
        initialBody={body}
        labels={labels ?? []}
        identities={identities ?? []}
        audienceCount={audienceCount}
      />
    </div>
  );
}
