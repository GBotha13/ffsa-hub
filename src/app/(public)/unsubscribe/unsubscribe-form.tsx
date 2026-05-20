"use client";

import { useState } from "react";

export function UnsubscribeForm({
  token,
  labelName,
  otherLabelNames,
}: {
  token: string;
  labelName: string | null;
  otherLabelNames: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [doneScope, setDoneScope] = useState<"label" | "all" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function unsubscribe(scope: "label" | "all") {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, scope }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    const data = (await res.json()) as { scope: "label" | "all" };
    setDoneScope(data.scope);
  }

  if (doneScope) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-bold">You&rsquo;re unsubscribed</h1>
        <p className="text-sm mt-2" style={{ color: "#64748b" }}>
          {doneScope === "all"
            ? "You won't receive any further marketing emails from us."
            : labelName
            ? `You won't receive further "${labelName}" emails.`
            : "You've been unsubscribed."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold">Unsubscribe</h1>
      <p className="text-sm mt-2" style={{ color: "#475569" }}>
        {labelName ? (
          <>
            You&rsquo;re about to stop receiving{" "}
            <strong>{labelName}</strong> emails.
          </>
        ) : (
          <>You&rsquo;re about to update your email preferences.</>
        )}
      </p>

      {otherLabelNames.length > 0 && (
        <p className="text-xs mt-3" style={{ color: "#64748b" }}>
          You&rsquo;ll still receive: {otherLabelNames.join(", ")}.
        </p>
      )}

      {err && <p className="text-sm mt-3" style={{ color: "#dc2626" }}>{err}</p>}

      <div className="mt-6 space-y-2">
        {labelName && (
          <button
            type="button"
            onClick={() => unsubscribe("label")}
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#1d4ed8" }}
          >
            Unsubscribe from {labelName}
          </button>
        )}
        <button
          type="button"
          onClick={() => unsubscribe("all")}
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
