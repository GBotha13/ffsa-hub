"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLabelColors } from "@/lib/label-color";

type Label = { id: string; slug: string; name: string; color: string | null };
type Identity = { id: string; display_name: string; from_email: string };

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  labels: { id: string; slug: string; name: string; color: string | null } | null;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-amber-100 text-amber-800",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export function CampaignsList({
  campaigns,
  labels,
  identities,
}: {
  campaigns: Campaign[];
  labels: Label[];
  identities: Identity[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [labelId, setLabelId] = useState(labels[0]?.id ?? "");
  const [identityId, setIdentityId] = useState(identities[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setErr("Campaign name is required.");
    if (!labelId) return setErr("Pick an audience label.");
    if (!identityId) return setErr("Pick a sending identity.");
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        labelId,
        sendingIdentityId: identityId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to create campaign");
      return;
    }
    const { campaign } = (await res.json()) as { campaign: { id: string } };
    router.push(`/communications/campaigns/${campaign.id}`);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Campaigns</CardTitle>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            + New campaign
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {creating && (
          <div className="border rounded-md p-4 space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name (internal)"
              className="w-full border rounded px-2 py-1.5 text-sm"
              disabled={busy}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-muted-foreground mb-1 text-xs">
                  Audience (label)
                </span>
                <select
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  disabled={busy}
                >
                  <option value="">— pick a label —</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-muted-foreground mb-1 text-xs">
                  Send from
                </span>
                <select
                  value={identityId}
                  onChange={(e) => setIdentityId(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  disabled={busy}
                >
                  <option value="">— pick an identity —</option>
                  {identities.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.display_name} ({i.from_email})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create &amp; open composer
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setErr(null);
                }}
                disabled={busy}
                className="px-3 py-1 rounded border text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Campaign</th>
                  <th className="text-left px-3 py-2 font-medium">Audience</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/communications/campaigns/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.subject && (
                        <div className="text-xs text-muted-foreground">
                          {c.subject}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.labels ? (
                        <span
                          className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium"
                          style={(() => {
                            const col = getLabelColors(c.labels);
                            return {
                              backgroundColor: col.bg,
                              color: col.text,
                              borderColor: col.border,
                            };
                          })()}
                        >
                          {c.labels.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {c.sent_at
                        ? `Sent ${new Date(c.sent_at).toLocaleString()}`
                        : c.scheduled_at
                        ? `Scheduled ${new Date(c.scheduled_at).toLocaleString()}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
