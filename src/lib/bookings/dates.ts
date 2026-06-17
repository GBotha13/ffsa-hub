// Date helpers for the bookings calendar + list. Calendar math is done in UTC
// for stability; "today" uses the local date so the highlight matches the user.

const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MON_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseMonthParam(param?: string): { year: number; month: number } {
  if (param) {
    const m = param.match(/^(\d{4})-(\d{1,2})$/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      if (month >= 1 && month <= 12) return { year, month };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthParam(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MON_LONG[month - 1]} ${year}`;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** A fixed 6-week (42-day) grid of ISO dates covering the given month. */
export function monthGridDays(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const cur = new Date(first);
  cur.setUTCDate(first.getUTCDate() - first.getUTCDay()); // back to Sunday
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export function isoMonth(iso: string): number {
  return parseInt(iso.slice(5, 7), 10);
}

export function isoDay(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

export function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export const WEEKDAY_HEADERS = WD_SHORT;

function shortDate(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  return `${d} ${MON_SHORT[m - 1]} ${y}`;
}

export function humanDate(iso: string): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  return `${WD_SHORT[dt.getUTCDay()]} ${shortDate(iso)}`;
}

/** "18 Mar 2026" or "11 Sep – 12 Sep 2026" for multi-day spans. */
export function dateRangeLabel(start: string, end: string | null): string {
  if (!end || end === start) return shortDate(start);
  return `${shortDate(start)} – ${shortDate(end)}`;
}

function hm(time: string | null): string | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad(parseInt(m[1], 10))}:${m[2]}` : null;
}

export function timeRangeLabel(start: string | null, end: string | null): string {
  const s = hm(start);
  const e = hm(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  if (e) return e;
  return "—";
}

export function timeLabel(time: string | null): string {
  return hm(time) ?? "—";
}

/** Every ISO date a booking covers, from booking_date through end_date. */
export function expandBookingDays(booking: {
  booking_date: string;
  end_date: string | null;
}): string[] {
  const start = booking.booking_date;
  const end = booking.end_date && booking.end_date > start ? booking.end_date : start;
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let guard = 0;
  while (cur <= last && guard < 90) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return out;
}
