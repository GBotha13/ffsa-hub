import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPreferencesToken } from "@/lib/tokens/unsubscribe";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = t ?? "";
  const v = verifyPreferencesToken(token);

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
  const { data: held } = await admin
    .from("contact_labels")
    .select("labels(id, name)")
    .eq("contact_id", v.contactId);

  const labels = (held ?? [])
    .map((r: { labels: { id: string; name: string } | null }) => r.labels)
    .filter((l): l is { id: string; name: string } => !!l);

  return shell(
    <PreferencesForm
      token={token}
      labels={labels.map((l) => ({ id: l.id, name: l.name }))}
    />
  );
}
