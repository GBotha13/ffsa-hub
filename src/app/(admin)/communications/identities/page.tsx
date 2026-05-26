import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/lib/require-permission";
import {
  listAllSendingIdentities,
  type SendingIdentity,
} from "@/services/sending-identities";
import { IdentitiesAdmin } from "./identities-admin";

export const dynamic = "force-dynamic";

export default async function IdentitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "communications");

  const { data } = await listAllSendingIdentities(supabase);
  const identities = (data ?? []) as SendingIdentity[];

  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">COMMUNICATIONS</p>
        <h1 className="page-title">Sending identities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The &ldquo;From&rdquo; addresses your campaigns can send through.
          Add one per work stream (events, giving, training, etc.) so each
          email feels like it&rsquo;s coming from the right voice.
        </p>
      </div>

      <IdentitiesAdmin initialIdentities={identities} />
    </div>
  );
}
