"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLabelColors } from "@/lib/label-color";

type Label = { id: string; slug: string; name: string; color: string | null };

type Outcome = {
  id: string;
  name: string;
  description: string | null;
  label_id: string | null;
  is_active: boolean;
  labels: { id: string; slug: string; name: string; color: string | null } | null;
};

export function OutcomesManager({
  eventId,
  outcomes,
  labels,
}: {
  eventId: string;
  outcomes: Outcome[];
  labels: Label[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [labelMode, setLabelMode] = useState<"existing" | "new">("existing");
  const [labelId, setLabelId] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addOutcome() {
    if (!name.trim()) {
      setErr("Outcome name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
    };
    if (labelMode === "existing" && labelId) payload.labelId = labelId;
    if (labelMode === "new" && newLabelName.trim()) payload.newLabelName = newLabelName.trim();

    const res = await fetch(`/api/events/${eventId}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to add outcome");
      return;
    }
    setAdding(false);
    setName("");
    setDescription("");
    setLabelId("");
    setNewLabelName("");
    router.refresh();
  }

  async function removeOutcome(outcomeId: string) {
    if (!confirm("Delete this outcome? Its response records will be removed too.")) return;
    setBusy(true);
    const res = await fetch(`/api/events/${eventId}/outcomes/${outcomeId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to delete");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Outcomes</CardTitle>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            + Add outcome
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Calls-to-action for this event. Responding to an outcome applies its label.
        </p>

        {outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No outcomes yet.</p>
        ) : (
          <ul className="space-y-2">
            {outcomes.map((o) => (
              <li
                key={o.id}
                className="flex items-start justify-between gap-3 border rounded p-3"
              >
                <div>
                  <p className="text-sm font-medium">{o.name}</p>
                  {o.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
                  )}
                  <div className="mt-1">
                    {o.labels ? (
                      <span
                        className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium"
                        style={(() => {
                          const c = getLabelColors(o.labels);
                          return {
                            backgroundColor: c.bg,
                            color: c.text,
                            borderColor: c.border,
                          };
                        })()}
                      >
                        {o.labels.name}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">No label assigned</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeOutcome(o.id)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline shrink-0"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <div className="border-t pt-3 space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Outcome name (e.g. Act Now for the Unreached)"
              className="w-full border rounded px-2 py-1.5 text-sm"
              disabled={busy}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none"
              disabled={busy}
            />
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={labelMode === "existing"}
                  onChange={() => setLabelMode("existing")}
                />
                Existing label
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={labelMode === "new"}
                  onChange={() => setLabelMode("new")}
                />
                New label
              </label>
            </div>
            {labelMode === "existing" ? (
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
            ) : (
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="New label name"
                className="w-full border rounded px-2 py-1.5 text-sm"
                disabled={busy}
              />
            )}
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addOutcome}
                disabled={busy}
                className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:bg-gray-300"
              >
                Save outcome
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
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
      </CardContent>
    </Card>
  );
}
