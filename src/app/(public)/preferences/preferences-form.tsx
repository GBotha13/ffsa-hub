"use client";

import { useMemo, useState } from "react";
import { PUBLIC_SHELL_TOKENS } from "@/components/public-form-shell";

const T = PUBLIC_SHELL_TOKENS;

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
      <div className="text-center py-4">
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            fontWeight: 700,
            color: T.yellow,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Preferences updated
        </p>
        <p style={{ fontSize: 14, color: T.textDim, lineHeight: 1.55 }}>
          {done === "all"
            ? "You've been unsubscribed from all marketing emails."
            : "Your email preferences have been saved."}
        </p>
      </div>
    );
  }

  const renderRow = (l: Label, highlighted: boolean) => {
    const isChecked = checked[l.id] ?? false;
    return (
      <label
        key={l.id}
        className={`ffsa-public-card flex items-center gap-3 cursor-pointer ${
          highlighted ? "is-selected" : ""
        }`}
        style={{ padding: "12px 14px" }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) =>
            setChecked((c) => ({ ...c, [l.id]: e.target.checked }))
          }
          style={{
            accentColor: T.yellow,
            width: 16,
            height: 16,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, color: T.text, fontSize: 14 }}>{l.name}</span>
      </label>
    );
  };

  return (
    <>
      {labels.length === 0 ? (
        <p style={{ fontSize: 14, color: T.textDim }}>
          You&rsquo;re not subscribed to any email lists.
        </p>
      ) : (
        <div className="space-y-5">
          {fromEmailLabels.length > 0 && (
            <div className="space-y-2">
              <p
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                  color: T.yellow,
                  textTransform: "uppercase",
                }}
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
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    fontWeight: 700,
                    color: T.textDimmer,
                    textTransform: "uppercase",
                  }}
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
        <p
          className="mt-4 rounded-lg px-3 py-2"
          style={{
            color: T.red,
            background: `${T.red}1a`,
            border: `1px solid ${T.red}33`,
            fontSize: 13,
          }}
        >
          {err}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {labels.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="ffsa-public-btn-primary w-full"
          >
            {busy ? "Saving…" : "Save preferences"}
          </button>
        )}
        <button
          type="button"
          onClick={unsubscribeAll}
          disabled={busy}
          className="w-full"
          style={{
            padding: "12px",
            borderRadius: 10,
            border: `1px solid ${T.borderSoft}`,
            background: "transparent",
            color: T.textDim,
            fontSize: 13,
            fontWeight: 500,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          Unsubscribe from all emails
        </button>
      </div>
    </>
  );
}
