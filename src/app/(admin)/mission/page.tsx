import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";

export default async function MissionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "mission");
  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">OUTREACH &amp; IMPACT</p>
        <h1 className="page-title">Mission</h1>
      </div>

      <div className="surface-2 rounded-xl border border-white/[0.06] p-10 text-center">
        <Globe className="h-10 w-10 mx-auto mb-4 opacity-40" />
        <p className="font-semibold text-white mb-2 uppercase tracking-widest text-sm">Coming Soon</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The Mission module is under development. It will track outreach
          trips, visiting teams, and ministry impact statistics including
          salvations, healings, gospel seeds, bibles distributed, and hours
          of prayer across all FFSA ministry activities.
        </p>
      </div>
    </div>
  );
}
