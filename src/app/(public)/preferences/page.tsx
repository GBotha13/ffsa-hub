import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrefsToken } from "@/lib/tokens/unsubscribe";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = t ?? "";
  const v = verifyPrefsToken(token);

  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#f1f5f9", colorScheme: "light" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 12px 32px -12px rgba(15,23,42,.18)",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (!v.valid || !v.contactId) {
    return shell(
      <div className="text-center">
        <h1 className="text-lg font-bold">Link not valid</h1>
        <p className="text-sm mt-2" style={{ color: "#64748b" }}>
          This preferences link is {v.reason ?? "invalid"}. Please use the link
          from a recent email.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();

  // Contact's current labels + (if this came from a campaign email) the
  // labels that campaign targeted, so we can highlight them at the top.
  const [{ data: held }, { data: campaignLabels }] = await Promise.all([
    admin
      .from("contact_labels")
      .select("labels(id, name)")
      .eq("contact_id", v.contactId),
    v.campaignId
      ? admin
          .from("campaign_labels")
          .select("label_id")
          .eq("campaign_id", v.campaignId)
      : Promise.resolve({ data: null }),
  ]);

  const labels = (held ?? [])
    .map((r: { labels: { id: string; name: string } | null }) => r.labels)
    .filter((l): l is { id: string; name: string } => !!l);

  const highlightedLabelIds = new Set(
    ((campaignLabels ?? []) as { label_id: string }[]).map((r) => r.label_id)
  );

  return shell(
    <PreferencesForm
      token={token}
      labels={labels.map((l) => ({ id: l.id, name: l.name }))}
      highlightedLabelIds={Array.from(highlightedLabelIds)}
    />
  );
}
