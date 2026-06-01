import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "./join-form";
import { JoinInvalid } from "./join-invalid";

type Params = { code: string };

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<Params> }) {
  const { code } = await params;

  const adminSupabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminSupabase as any)
    .from("public_signup_settings")
    .select("code, enabled")
    .eq("id", 1)
    .single();

  const valid = !!data && data.code === code && data.enabled === true;

  if (!valid) {
    return <JoinInvalid />;
  }

  return <JoinForm code={code} />;
}
