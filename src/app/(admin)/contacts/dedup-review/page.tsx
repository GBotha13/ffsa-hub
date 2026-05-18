import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { listDedupReview } from "@/services/dedup-review";
import { ReviewQueueList } from "./review-queue-list";
import Link from "next/link";

export default async function DedupReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "pending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "contacts");

  const { data: items, count } = await listDedupReview(supabase, {
    status,
    limit: 100,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/contacts"
            className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest"
          >
            ← Contacts
          </Link>
          <h1 className="text-2xl font-bold mt-2">Dedup review queue</h1>
          <p className="text-sm text-gray-600 mt-1">
            Contacts where the incoming email matched one record and the incoming phone
            matched a different one. Resolve each conflict manually.
          </p>
        </div>
        <div className="flex gap-1 text-sm">
          {["pending", "resolved_merge", "resolved_separate", "resolved_discard"].map((s) => (
            <Link
              key={s}
              href={`/contacts/dedup-review?status=${s}`}
              className={`px-3 py-1 rounded border ${
                status === s ? "bg-gray-900 text-white" : "hover:bg-gray-50"
              }`}
            >
              {s.replace("resolved_", "").replace("_", " ")}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {count ?? 0} item{(count ?? 0) === 1 ? "" : "s"} ({status.replace("_", " ")})
      </p>

      <ReviewQueueList items={items ?? []} />
    </div>
  );
}
