"use client";

import { useMemo, useState } from "react";

const SHELL = {
  bg: "#0D0B09",
  card: "#141210",
  border: "#2a2420",
  text: "#F0EBE3",
  textDim: "#B8A898",
  textDimmer: "#7a6e64",
  yellow: "#F5C518",
};

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 20;
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 7;

type DaySlots = {
  date: Date;
  label: string;
  weekday: string;
  slots: { startsAt: string; endsAt: string; label: string }[];
};

function buildDayGrid(durationMinutes: number): DaySlots[] {
  const now = new Date();
  // Start tomorrow at SLOT_START_HOUR local time
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(SLOT_START_HOUR, 0, 0, 0);

  const days: DaySlots[] = [];

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);

    const slots: { startsAt: string; endsAt: string; label: string }[] = [];

    for (
      let mins = 0;
      mins < (SLOT_END_HOUR - SLOT_START_HOUR) * 60;
      mins += SLOT_MINUTES
    ) {
      const slotStart = new Date(date);
      slotStart.setMinutes(slotStart.getMinutes() + mins);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

      if (slotStart.getTime() <= Date.now()) continue;

      slots.push({
        startsAt: slotStart.toISOString(),
        endsAt: slotEnd.toISOString(),
        label: slotStart.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    days.push({
      date,
      label: date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
      slots,
    });
  }

  return days;
}

export function SlotPicker({
  token,
  recipientFirstName,
  senderName,
  durationMinutes,
  message,
}: {
  token: string;
  recipientFirstName: string;
  senderName: string;
  durationMinutes: number;
  message: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => buildDayGrid(durationMinutes), [durationMinutes]);

  function toggleSlot(startsAt: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(startsAt)) next.delete(startsAt);
      else next.add(startsAt);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);

    // Build slot payload from selected start times
    const slotsByStart = new Map<string, { startsAt: string; endsAt: string }>();
    for (const day of days) {
      for (const slot of day.slots) {
        if (selected.has(slot.startsAt)) {
          slotsByStart.set(slot.startsAt, {
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          });
        }
      }
    }
    const payloadSlots = Array.from(slotsByStart.values()).map((s) => ({
      starts_at: s.startsAt,
      ends_at: s.endsAt,
    }));

    try {
      const res = await fetch(`/api/scheduling/${token}/slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: payloadSlots }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not submit your times. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not submit your times. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: SHELL.bg }}
      >
        <div className="text-center max-w-md">
          <h1
            style={{
              fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
              fontSize: "2rem",
              color: SHELL.text,
              letterSpacing: "0.04em",
            }}
          >
            Thanks!
          </h1>
          <p className="text-sm mt-2" style={{ color: SHELL.textDim }}>
            We&rsquo;ve received your times. {senderName} will confirm one and
            send you a calendar invite by email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{ background: SHELL.bg }}
    >
      <div className="mx-auto" style={{ maxWidth: "640px" }}>
        <p
          style={{
            fontSize: "10px",
            letterSpacing: "0.25em",
            fontWeight: 700,
            color: SHELL.yellow,
            textTransform: "uppercase",
          }}
        >
          Pick a Time
        </p>
        <h1
          style={{
            fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
            fontSize: "2rem",
            color: SHELL.text,
            letterSpacing: "0.03em",
            marginTop: "4px",
          }}
        >
          Hi {recipientFirstName}
        </h1>
        <p style={{ color: SHELL.textDim, fontSize: "15px", lineHeight: 1.5, marginTop: "8px" }}>
          {senderName} would love to schedule a{" "}
          <strong style={{ color: SHELL.text }}>
            {durationMinutes}-minute call
          </strong>{" "}
          with you. Tap as many times as work — we&rsquo;ll confirm one back to
          you by email.
        </p>

        {message && (
          <div
            className="mt-4 rounded-lg p-4"
            style={{
              background: SHELL.card,
              border: `1px solid ${SHELL.border}`,
              color: SHELL.textDim,
              fontSize: "14px",
              fontStyle: "italic",
            }}
          >
            &ldquo;{message}&rdquo;
          </div>
        )}

        <p
          style={{
            fontSize: "11px",
            color: SHELL.textDimmer,
            marginTop: "20px",
          }}
        >
          Times shown in your local time zone.
        </p>

        <div className="mt-3 space-y-5">
          {days.map((day) => {
            if (day.slots.length === 0) return null;
            return (
              <div key={day.date.toISOString()}>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    fontWeight: 700,
                    color: SHELL.yellow,
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  {day.weekday} &middot; {day.label}
                </div>
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(90px, 1fr))",
                  }}
                >
                  {day.slots.map((slot) => {
                    const isSelected = selected.has(slot.startsAt);
                    return (
                      <button
                        key={slot.startsAt}
                        onClick={() => toggleSlot(slot.startsAt)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: isSelected
                            ? `1px solid ${SHELL.yellow}`
                            : `1px solid ${SHELL.border}`,
                          background: isSelected
                            ? SHELL.yellow
                            : SHELL.card,
                          color: isSelected ? SHELL.bg : SHELL.text,
                          fontSize: "13px",
                          fontWeight: isSelected ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 120ms ease",
                        }}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p
            className="mt-4"
            style={{ color: "hsl(0 75% 65%)", fontSize: "13px" }}
          >
            {error}
          </p>
        )}

        <div
          className="sticky bottom-4 mt-6 rounded-lg p-3 flex items-center justify-between gap-3"
          style={{
            background: SHELL.card,
            border: `1px solid ${SHELL.border}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <span style={{ color: SHELL.textDim, fontSize: "13px" }}>
            {selected.size === 0
              ? "Tap at least one time to continue"
              : `${selected.size} time${selected.size === 1 ? "" : "s"} selected`}
          </span>
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background:
                selected.size === 0 || submitting
                  ? "hsl(22 8% 18%)"
                  : SHELL.yellow,
              color:
                selected.size === 0 || submitting
                  ? SHELL.textDimmer
                  : SHELL.bg,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor:
                selected.size === 0 || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Sending…" : "Send my times"}
          </button>
        </div>
      </div>
    </div>
  );
}
