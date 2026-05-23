"use client";

import { useMemo, useState } from "react";

type Label = { id: string; name: string };

export function PreferencesForm({
  token,
  labels,
  highlightedLabelIds,
}: {
  token: string;
  labels: Label[];
  highlightedLabelIds: string[];
}) {
  // Every label starts checked (subscribed); unchecking = unsubscribe.
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(labels.map((l) => [l.id, true]))
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"saved" | "all" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const highlightSet = useMemo(
    () => new Set(highlightedLabelIds),
    [highlightedLabelIds]
  );

  const { fromEmailLabels, otherLabels } = useMemo(() => {
    const fromEmail: Label[] = [];
    const other: Label[] = [];
    for (const l of labels) {
      if (highlightSet.has(l.id)) fromEmail.push(l);
      else other.push(l);
    }
    return { fromEmailLabels: fromEmail, otherLabels: other };
  }, [labels, highlightSet]);

  async function save() {
    setBusy(true);
    setErr(null);
    const keepLabelIds = labels.filter((l) => checked[l.id]).map((l) => l.id);
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, keepLabelIds }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Something went wrong.");
      return;
    }
    setDone("saved");
  }

  async function unsubscribeAll() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, all: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Something went wrong.");
      return;
    }
    setDone("all");
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-bold">Preferences updated</h1>
        <p className="text-sm mt-2" style={{ color: "#64748b" }}>
          {done === "all"
            ? "You've been unsubscribed from all marketing emails."
            : "Your email preferences have been saved."}
        </p>
      </div>
    );
  }

  const renderRow = (l: Label, highlighted: boolean) => (
    <label
      key={l.id}
      className="flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer"
      style={{
        borderColor: highlighted ? "#1d4ed8" : "#e2e8f0",
        background: highlighted ? "#eff6ff" : "transparent",
        color: "#1e293b",
      }}
    >
      <input
        type="checkbox"
        checked={checked[l.id] ?? false}
        onChange={(e) =>
          setChecked((c) => ({ ...c, [l.id]: e.target.checked }))
        }
        style={{ accentColor: "#1d4ed8", width: 16, height: 16 }}
      />
      <span className="flex-1">{l.name}</span>
    </label>
  );

  return (
    <div>
      <h1 className="text-lg font-bold">Email preferences</h1>
      <p className="text-sm mt-2" style={{ color: "#475569" }}>
        Uncheck anything you want to stop receiving. Your changes save when you
        hit the button at the bottom.
      </p>

      {labels.length === 0 ? (
        <p className="text-sm mt-4" style={{ color: "#64748b" }}>
          You&rsquo;re not subscribed to any email lists.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {fromEmailLabels.length > 0 && (
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#1d4ed8", letterSpacing: "0.08em" }}
              >
                From this email
              </p>
              <div className="space-y-2">
                {fromEmailLabels.map((l) => renderRow(l, true))}
              </div>
            </div>
          )}

          {otherLabels.length > 0 && (
            <div className="space-y-2">
              {fromEmailLabels.length > 0 && (
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#64748b", letterSpacing: "0.08em" }}
                >
                  Your other subscriptions
                </p>
              )}
              <div className="space-y-2">
                {otherLabels.map((l) => renderRow(l, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {err && (
        <p className="text-sm mt-3" style={{ color: "#dc2626" }}>
          {err}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {labels.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#1d4ed8" }}
          >
            Save preferences
          </button>
        )}
        <button
          type="button"
          onClick={unsubscribeAll}
          disabled={busy}
          className="w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ border: "1px solid #e2e8f0", color: "#475569" }}
        >
          Unsubscribe from all emails
        </button>
      </div>
    </div>
  );
}
