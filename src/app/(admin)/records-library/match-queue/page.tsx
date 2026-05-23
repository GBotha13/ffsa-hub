import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { listMatchQueue } from "@/services/records-library";
import { MatchQueueList } from "./match-queue-list";

export default async function MatchQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "records-library");

  const queueRes = await listMatchQueue(supabase, { status: "pending" });
  const queue = queueRes.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Match queue</h1>
        <p className="text-sm text-gray-600">
          These library records partially matched an existing user but
          didn&apos;t meet the auto-link bar. Approve to link, reject to
          dismiss.
        </p>
      </div>
      <MatchQueueList items={queue} />
    </div>
  );
}
