"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ContactMatch = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type ReviewItem = {
  id: string;
  incoming_data: Record<string, unknown>;
  email_match_contact_id: string | null;
  phone_match_contact_id: string | null;
  source_type: string;
  source_id: string | null;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  email_match: ContactMatch | null;
  phone_match: ContactMatch | null;
};

export function ReviewQueueList({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">Nothing here.</p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ReviewCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(
    kind: "merge" | "separate" | "discard",
    targetContactId?: string
  ) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/dedup-review/${item.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, targetContactId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to resolve");
      return;
    }
    router.refresh();
  }

  const incoming = item.incoming_data;
  const isPending = item.status === "pending";

  return (
    <div className="border rounded-md p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {item.source_type}
            {item.source_id ? ` · ${item.source_id}` : ""} ·{" "}
            {new Date(item.created_at).toLocaleString()}
          </p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
              isPending
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {item.status.replace("resolved_", "")}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Incoming">
          <ContactFields data={incoming} />
        </Panel>
        <Panel title={item.email_match ? "Email matched" : "—"}>
          {item.email_match ? (
            <>
              <ContactFields data={item.email_match} />
              {isPending && (
                <button
                  type="button"
                  onClick={() => resolve("merge", item.email_match!.id)}
                  disabled={busy}
                  className="mt-2 w-full text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Merge into this
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">No email match.</p>
          )}
        </Panel>
        <Panel title={item.phone_match ? "Phone matched" : "—"}>
          {item.phone_match ? (
            <>
              <ContactFields data={item.phone_match} />
              {isPending && (
                <button
                  type="button"
                  onClick={() => resolve("merge", item.phone_match!.id)}
                  disabled={busy}
                  className="mt-2 w-full text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Merge into this
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">No phone match.</p>
          )}
        </Panel>
      </div>

      {isPending && (
        <div className="flex gap-2 text-sm pt-2 border-t">
          <button
            type="button"
            onClick={() => resolve("separate")}
            disabled={busy}
            className="px-3 py-1 rounded border hover:bg-gray-50 disabled:bg-gray-100"
          >
            Keep separate (create new)
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Discard this submission entirely?")) resolve("discard");
            }}
            disabled={busy}
            className="px-3 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:bg-gray-100"
          >
            Discard
          </button>
          {err && <span className="text-xs text-red-600 self-center">{err}</span>}
        </div>
      )}

      {item.resolution_notes && (
        <p className="text-xs text-gray-500 italic">{item.resolution_notes}</p>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded p-3 bg-gray-50/50">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function ContactFields({ data }: { data: ContactMatch | Record<string, unknown> }) {
  const display: { k: string; v: string }[] = [];
  const fields = [
    "first_name",
    "last_name",
    "preferred_name",
    "email",
    "phone",
    "city",
    "country",
  ];
  for (const f of fields) {
    const v = (data as Record<string, unknown>)[f];
    if (v) display.push({ k: f, v: String(v) });
  }
  if (display.length === 0) {
    return <p className="text-xs text-gray-400">—</p>;
  }
  return (
    <dl className="text-xs space-y-1">
      {display.map((row) => (
        <div key={row.k} className="flex gap-2">
          <dt className="text-gray-500 min-w-[80px]">{row.k}</dt>
          <dd className="text-gray-900 break-all">{row.v}</dd>
        </div>
      ))}
    </dl>
  );
}
