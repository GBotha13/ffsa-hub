// Booking clash detection. Shared by the API (warn at create time) and the
// calendar / list views (flag overlapping bookings). Per the locked scope a
// clash is a WARNING, never a hard block.

export type BookingWindow = {
  id: string;
  venue_id: string;
  booking_date: string; // YYYY-MM-DD (first / only day)
  end_date: string | null; // multi-day span, or null for a single day
  setup_time: string | null;
  start_time: string | null;
  end_time: string | null;
  setdown_time: string | null;
  status: string;
};

const DAY_START = 0;
const DAY_END = 24 * 60;

function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function isMultiDay(b: BookingWindow): boolean {
  return b.end_date != null && b.end_date > b.booking_date;
}

/**
 * The minutes-of-day window the venue is actually occupied: from set-up (or
 * event start) through set-down (or event end). Multi-day bookings and
 * bookings with no times are treated as occupying the whole day.
 */
export function occupiedWindow(b: BookingWindow): { start: number; end: number } {
  if (isMultiDay(b)) return { start: DAY_START, end: DAY_END };
  const start = toMinutes(b.setup_time) ?? toMinutes(b.start_time);
  const end = toMinutes(b.setdown_time) ?? toMinutes(b.end_time);
  if (start == null || end == null) return { start: DAY_START, end: DAY_END };
  return { start, end: Math.max(end, start) };
}

/** Denied / cancelled bookings never clash with anything. */
function isLiveStatus(status: string): boolean {
  return status === "pending" || status === "approved";
}

export function datesOverlap(a: BookingWindow, b: BookingWindow): boolean {
  const aEnd = a.end_date ?? a.booking_date;
  const bEnd = b.end_date ?? b.booking_date;
  // ISO date strings compare correctly lexicographically.
  return a.booking_date <= bEnd && b.booking_date <= aEnd;
}

/** True if two bookings clash: same venue, overlapping days AND overlapping time. */
export function bookingsConflict(a: BookingWindow, b: BookingWindow): boolean {
  if (a.id && b.id && a.id === b.id) return false;
  if (a.venue_id !== b.venue_id) return false;
  if (!isLiveStatus(a.status) || !isLiveStatus(b.status)) return false;
  if (!datesOverlap(a, b)) return false;
  const aw = occupiedWindow(a);
  const bw = occupiedWindow(b);
  // Strict overlap — back-to-back (one ends exactly when the next sets up) is fine.
  return aw.start < bw.end && bw.start < aw.end;
}

/** Existing bookings that clash with a candidate (which may have no id yet). */
export function findConflicts(
  candidate: BookingWindow,
  existing: BookingWindow[]
): BookingWindow[] {
  return existing.filter((b) => bookingsConflict(candidate, b));
}

/** Ids of every booking in the set that clashes with at least one other. */
export function conflictingIds(bookings: BookingWindow[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      if (bookingsConflict(bookings[i], bookings[j])) {
        ids.add(bookings[i].id);
        ids.add(bookings[j].id);
      }
    }
  }
  return ids;
}
