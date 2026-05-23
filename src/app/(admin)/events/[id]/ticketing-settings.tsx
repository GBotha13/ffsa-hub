"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TicketingSettings({
  eventId,
  ticketingEnabled,
  publicSlug,
}: {
  eventId: string;
  ticketingEnabled: boolean;
  publicSlug: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(ticketingEnabled);
  const [slug, setSlug] = useState(publicSlug ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const dirty =
    enabled !== ticketingEnabled || (slug.trim() || null) !== publicSlug;

  async function save() {
    setBusy(true);
    setErr(null);
    setSavedHint(null);

    const res = await fetch(`/api/events/${eventId}/ticketing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketing_enabled: enabled,
        public_slug: slug.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to save");
      return;
    }
    setSavedHint("Saved.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ticketing settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          When ticketing is enabled, this event has a public storefront at{" "}
          <code className="text-xs">/events/&lt;slug&gt;</code>.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
          />
          Enable ticketing on this event
        </label>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Public URL slug
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">/events/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="holy-spirit-conference-2026"
              className="flex-1 border rounded px-2 py-1.5"
              disabled={busy}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lowercase letters, digits and dashes. Must be unique across events.
          </p>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {savedHint && <p className="text-xs text-green-600">{savedHint}</p>}
        <div>
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:bg-gray-300"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
