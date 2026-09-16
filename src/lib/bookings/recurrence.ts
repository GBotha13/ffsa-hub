// Weekly recurrence expansion for booking series.
// Pure date math — no wall-clock reads, so it's deterministic and testable.

/**
 * Returns every ISO date (YYYY-MM-DD) between seriesStart and seriesEnd
 * (inclusive) that falls on the given weekday.
 *
 * weekday: 0 = Sunday … 6 = Saturday (matches JS getUTCDay / Postgres DOW).
 * All math is done in UTC to avoid timezone drift around midnight.
 */
export function weeklyOccurrenceDates(
  seriesStart: string,
  seriesEnd: string,
  weekday: number,
  intervalWeeks = 1
): string[] {
  const out: string[] = [];
  const start = new Date(`${seriesStart}T00:00:00Z`);
  const end = new Date(`${seriesEnd}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
  if (weekday < 0 || weekday > 6) return out;
  const step = Math.max(1, Math.round(intervalWeeks)) * 7;

  const cur = new Date(start.getTime());
  // Advance to the first matching weekday on or after the start date.
  const diff = (weekday - cur.getUTCDay() + 7) % 7;
  cur.setUTCDate(cur.getUTCDate() + diff);

  const maxOccurrences = Math.ceil(520 / Math.max(1, intervalWeeks));
  let guard = 0;
  while (cur <= end && guard < maxOccurrences) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + step);
    guard++;
  }
  return out;
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "";
}

export const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, value) => ({
  value,
  label,
}));

export const RECURRENCE_INTERVAL_OPTIONS = [
  { value: 1, label: "Weekly" },
  { value: 2, label: "Bi-weekly" },
];
