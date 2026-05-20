"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLabelColors } from "@/lib/label-color";

type Label = { id: string; slug: string; name: string; color: string | null };

export function BaseLabelPicker({
  eventId,
  currentLabelId,
  labels,
}: {
  eventId: string;
  currentLabelId: string | null;
  labels: Label[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentLabelId ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(next: string) {
    setValue(next);
    setBusy(true);
    setErr(null);
    setSaved(false);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_label_id: next || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to save");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const current = labels.find((l) => l.id === value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Base label</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-2">
          Applied to every contact who submits any form for this event.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={value}
            onChange={(e) => save(e.target.value)}
            disabled={busy}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">— none —</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {current && (
            <span
              className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium"
              style={(() => {
                const c = getLabelColors(current);
                return { backgroundColor: c.bg, color: c.text, borderColor: c.border };
              })()}
            >
              {current.name}
            </span>
          )}
          {busy && <span className="text-xs text-muted-foreground">Saving…</span>}
          {saved && !busy && <span className="text-xs text-green-600">Saved</span>}
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
