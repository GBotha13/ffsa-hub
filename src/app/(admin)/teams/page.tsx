import { UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "teams");
  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">MINISTRY TEAMS</p>
        <h1 className="page-title">Teams</h1>
      </div>

      <div className="surface-2 rounded-xl border border-white/[0.06] p-10 text-center">
        <UsersRound className="h-10 w-10 mx-auto mb-4 opacity-40" />
        <p className="font-semibold text-white mb-2 uppercase tracking-widest text-sm">Coming Soon</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The Teams module is under development. It will manage ministry and
          outreach team rosters, department structure, and team leadership for
          all FFSA ministries.
        </p>
      </div>
    </div>
  );
}
