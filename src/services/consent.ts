// ────────────────────────────────────────────────────────────
// CONSENT AGREEMENTS + RECORDS
// ────────────────────────────────────────────────────────────
// Reads the current privacy / data-processing agreement and
// records acceptance events for audit purposes.

type Client = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ConsentAgreement = {
  id: string;
  version: string;
  title: string;
  body_markdown: string;
  effective_at: string;
  is_current: boolean;
};

export async function getCurrentConsentAgreement(supabase: Client) {
  return supabase
    .from("consent_agreements")
    .select("id, version, title, body_markdown, effective_at, is_current")
    .eq("is_current", true)
    .single();
}

export async function getConsentAgreementByVersion(
  supabase: Client,
  version: string
) {
  return supabase
    .from("consent_agreements")
    .select("id, version, title, body_markdown, effective_at, is_current")
    .eq("version", version)
    .single();
}

export async function recordConsent(
  supabase: Client,
  data: {
    agreement_version: string;
    source: "application" | "onboarding";
    user_id?: string | null;
    applicant_email?: string | null;
    application_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  }
) {
  return supabase.from("consent_records").insert(data).select().single();
}

export async function getConsentRecordsForUser(supabase: Client, userId: string) {
  return supabase
    .from("consent_records")
    .select("*")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false });
}
