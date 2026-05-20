import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/tokens/unsubscribe";
import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = t ?? "";
  const v = verifyUnsubscribeToken(token);

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
          This unsubscribe link is {v.reason ?? "invalid"}. Please use the link
          from a recent email.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();

  // The label this email was sent for + the contact's other labels.
  const [{ data: thisLabel }, { data: held }] = await Promise.all([
    v.labelId
      ? admin.from("labels").select("name").eq("id", v.labelId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("contact_labels")
      .select("labels(id, name)")
      .eq("contact_id", v.contactId),
  ]);

  const otherLabels = (held ?? [])
    .map((r: { labels: { id: string; name: string } | null }) => r.labels)
    .filter((l): l is { id: string; name: string } => !!l && l.id !== v.labelId);

  return shell(
    <UnsubscribeForm
      token={token}
      labelName={thisLabel?.name ?? null}
      otherLabelNames={otherLabels.map((l) => l.name)}
    />
  );
}
