"use client";

import { useMemo, useState } from "react";
import {
  PublicFormShell,
  PUBLIC_SHELL_TOKENS,
} from "@/components/public-form-shell";

const T = PUBLIC_SHELL_TOKENS;

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
      <PublicFormShell eyebrow="Thanks" heading="Times received" maxWidth={520}>
        <p
          style={{
            fontSize: 15,
            color: T.textDim,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          We&rsquo;ve received your times. {senderName} will confirm one and
          send you a calendar invite by email.
        </p>
      </PublicFormShell>
    );
  }

  return (
    <PublicFormShell
      eyebrow="Pick a Time"
      heading={`Hi ${recipientFirstName}`}
      subheading={`${senderName} would love to schedule a ${durationMinutes}-minute call. Tap as many times as work — we'll confirm one back to you.`}
      maxWidth={680}
    >
      {message && (
        <div
          className="mb-5 rounded-lg p-4"
          style={{
            background: T.cardElev,
            border: `1px solid ${T.borderSoft}`,
            color: T.textDim,
            fontSize: 14,
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          &ldquo;{message}&rdquo;
        </div>
      )}

      <p
        style={{
          fontSize: 11,
          color: T.textDimmer,
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        Times shown in your local time zone.
      </p>

      <div className="space-y-5">
        {days.map((day) => {
          if (day.slots.length === 0) return null;
          return (
            <div key={day.date.toISOString()}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  fontWeight: 700,
                  color: T.yellow,
                  textTransform: "uppercase",
                  marginBottom: 8,
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
                        borderRadius: 6,
                        border: isSelected
                          ? `1px solid ${T.yellow}`
                          : `1px solid ${T.borderSoft}`,
                        background: isSelected ? T.yellow : T.cardElev,
                        color: isSelected ? T.bg : T.text,
                        fontSize: 13,
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
          className="mt-5 rounded-lg px-3 py-2"
          style={{
            color: T.red,
            background: `${T.red}1a`,
            border: `1px solid ${T.red}33`,
            fontSize: 13,
          }}
        >
          {error}
        </p>
      )}

      <div
        className="sticky bottom-4 mt-6 rounded-lg p-3 flex items-center justify-between gap-3"
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <span style={{ color: T.textDim, fontSize: 13 }}>
          {selected.size === 0
            ? "Tap at least one time to continue"
            : `${selected.size} time${selected.size === 1 ? "" : "s"} selected`}
        </span>
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0 || submitting}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background:
              selected.size === 0 || submitting
                ? T.borderSoft
                : T.yellow,
            color:
              selected.size === 0 || submitting ? T.textDimmer : T.bg,
            fontSize: 12,
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
    </PublicFormShell>
  );
}
