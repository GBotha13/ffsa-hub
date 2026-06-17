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
  weekday: number
): string[] {
  const out: string[] = [];
  const start = new Date(`${seriesStart}T00:00:00Z`);
  const end = new Date(`${seriesEnd}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
  if (weekday < 0 || weekday > 6) return out;

  const cur = new Date(start.getTime());
  // Advance to the first matching weekday on or after the start date.
  const diff = (weekday - cur.getUTCDay() + 7) % 7;
  cur.setUTCDate(cur.getUTCDate() + diff);

  let guard = 0;
  while (cur <= end && guard < 520 /* ~10 years of weeks */) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 7);
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
