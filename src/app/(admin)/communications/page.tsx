import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";

export default async function CommunicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "communications");
  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">ANNOUNCEMENTS &amp; OUTREACH</p>
        <h1 className="page-title">Communications</h1>
      </div>

      <div className="surface-2 rounded-xl border border-white/[0.06] p-10 text-center">
        <Mail className="h-10 w-10 mx-auto mb-4 opacity-40" />
        <p className="font-semibold text-white mb-2 uppercase tracking-widest text-sm">Coming Soon</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The Communications module is under development. It will handle
          internal announcements, partner update tracking, email/SMS
          campaigns, and communication history for staff and supporters.
        </p>
      </div>
    </div>
  );
}
