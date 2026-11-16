/**
 * When the prayer room is closed to practice and to new sets on the wall.
 *
 * An approved booking of the auditorium (the prayer room's venue) occupies
 * the room from set-up through set-down, whether or not a devo set sits in
 * that window. A prayer-room block-out does the same. Pending, denied and
 * cancelled bookings do not.
 *
 * Times are the wall clock stored on the booking — Africa/Johannesburg, the
 * same clock practice uses. `date` and `time` columns have no zone, so this
 * never converts them through UTC. Touching at an edge is not an overlap.
 *
 * The same rules are enforced in the database by practice_assert_room_open
 * (migration 316). This module is what the wall and the practice UI grey
 * against. It never carries a booking title.
 */

import { occupiedWindow, type BookingWindow } from "@/lib/bookings/conflicts";
import { PRAYER_ROOM_VENUE_SLUG } from "@/lib/prayer-room/venue";

export const AUDITORIUM_BOOKED_LABEL = "Auditorium booked";
const BLOCKED_LABEL = "Blocked";
const DAY_END = 24 * 60;

export type RoomClosure = {
  id: string;
  block_date: string;
  end_date: string;
  /** Null times mean the whole day. */
  start_time: string | null;
  end_time: string | null;
  label: string;
  source: "auditorium" | "blockout";
};

export type AuditoriumBooking = {
  id: string;
  venueSlug: string;
  status: string;
  booking_date: string;
  end_date: string | null;
  setup_time: string | null;
  start_time: string | null;
  end_time: string | null;
  setdown_time: string | null;
};

export type BlockoutSpan = {
  id: string;
  block_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  reason?: string | null;
};

function hhmm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMin(t: string | null | undefined): number | null {
  const m = (t ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/** Calendar date in Africa/Johannesburg for an instant. Bookings are stored on this date. */
export function johannesburgDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The closure an approved auditorium booking imposes, or null when this
 * booking does not close the room. Setup and set-down widen the window.
 * The result has no title and no requester.
 */
export function auditoriumClosure(b: AuditoriumBooking): RoomClosure | null {
  if (b.venueSlug !== PRAYER_ROOM_VENUE_SLUG) return null;
  if (b.status !== "approved") return null;

  const endDate = b.end_date && b.end_date > b.booking_date ? b.end_date : b.booking_date;
  const window = occupiedWindow({
    id: b.id,
    venue_id: b.venueSlug,
    booking_date: b.booking_date,
    end_date: b.end_date,
    setup_time: b.setup_time,
    start_time: b.start_time,
    end_time: b.end_time,
    setdown_time: b.setdown_time,
    status: b.status,
  } satisfies BookingWindow);
  const allDay = window.start <= 0 && window.end >= DAY_END;

  return {
    id: `auditorium:${b.id}`,
    block_date: b.booking_date,
    end_date: endDate,
    start_time: allDay ? null : hhmm(window.start),
    end_time: allDay ? null : hhmm(Math.min(window.end, DAY_END)),
    label: AUDITORIUM_BOOKED_LABEL,
    source: "auditorium",
  };
}

/** A block-out already on the schedule. A blank reason stays the generic "Blocked". */
export function blockoutClosure(b: BlockoutSpan): RoomClosure {
  const start = b.start_time ? hhmm(toMin(b.start_time) ?? 0) : null;
  const end = b.end_time ? hhmm(toMin(b.end_time) ?? 0) : null;
  const timed = !!start && !!end;
  return {
    id: b.id.startsWith("blockout:") ? b.id : `blockout:${b.id}`,
    block_date: b.block_date,
    end_date: b.end_date && b.end_date >= b.block_date ? b.end_date : b.block_date,
    start_time: timed ? start : null,
    end_time: timed ? end : null,
    label: b.reason?.trim() || BLOCKED_LABEL,
    source: "blockout",
  };
}

/** Strict overlap. Sharing an endpoint (one ends as the next starts) is free. */
export function minutesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** The first closure that covers this slot, or null when the slot is free. */
export function closureCovering(
  closures: RoomClosure[],
  date: string,
  startMin: number,
  endMin: number
): RoomClosure | null {
  for (const c of closures) {
    if (date < c.block_date || date > c.end_date) continue;
    if (!c.start_time || !c.end_time) return c;
    const start = toMin(c.start_time);
    const end = toMin(c.end_time);
    // An unreadable window is treated as the whole day so a bad row cannot
    // look free. The booking path fails closed for the same reason.
    if (start == null || end == null) return c;
    if (minutesOverlap(startMin, endMin, start, end)) return c;
  }
  return null;
}
