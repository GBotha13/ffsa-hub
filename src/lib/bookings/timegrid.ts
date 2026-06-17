// Geometry helpers for the day / week time-grid views: turning a booking's
// times into a positioned block, and packing overlapping blocks into lanes so
// clashes sit side-by-side instead of on top of each other.

type TimedBooking = {
  setup_time: string | null;
  start_time: string | null;
  end_time: string | null;
  setdown_time: string | null;
};

function toMin(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/**
 * The occupied window (minutes-of-day) the venue is in use: set-up → set-down,
 * falling back to the event start → end. Returns null when there are no times
 * at all (rendered as an all-day band instead of a positioned block).
 */
export function blockWindow(b: TimedBooking): { start: number; end: number } | null {
  const start = toMin(b.setup_time) ?? toMin(b.start_time);
  const end = toMin(b.setdown_time) ?? toMin(b.end_time);
  if (start == null && end == null) return null;
  const s = start ?? end!;
  const e = end ?? start!;
  if (s >= e) return { start: s, end: Math.min(s + 60, 24 * 60) }; // min 1h block
  return { start: s, end: e };
}

export type LaidOut<T> = { item: T; start: number; end: number; lane: number; lanes: number };

/** Greedy lane assignment: overlapping intervals get distinct lanes within a
 *  cluster, and every member of a cluster knows the cluster's total lane count
 *  (so each can compute its width). */
export function packLanes<T>(
  intervals: { item: T; start: number; end: number }[]
): LaidOut<T>[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: LaidOut<T>[] = [];
  let cluster: { item: T; start: number; end: number; lane: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((mx, c) => Math.max(mx, c.lane + 1), 0);
    for (const c of cluster) out.push({ ...c, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const iv of sorted) {
    if (cluster.length && iv.start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.end > iv.start).map((c) => c.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ ...iv, lane });
    clusterEnd = Math.max(clusterEnd, iv.end);
  }
  if (cluster.length) flush();
  return out;
}

/** Hour bounds for the grid: a sensible default, expanded to fit any outliers. */
export function computeHourRange(
  windows: ({ start: number; end: number } | null)[],
  defStart = 7,
  defEnd = 22
): { startHour: number; endHour: number } {
  let startHour = defStart;
  let endHour = defEnd;
  for (const w of windows) {
    if (!w) continue;
    startHour = Math.min(startHour, Math.floor(w.start / 60));
    endHour = Math.max(endHour, Math.ceil(w.end / 60));
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

/** Local minutes-of-day, for the "now" line (client-only). */
export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
