// "Mark as fixed" (Gideon, 23 Nov 2026): a Fix now point on a vehicle can be marked fixed
// on the vehicle's page, with the date, who fixed it and what was done, without doing a
// whole inspection. The point goes back to OK as of that date; the next inspection that
// checks it overrides it as usual. Deleting an inspection rebuilds the vehicle's condition
// from the remaining inspections, so fixes newer than the rebuilt result are kept.

import type { ConditionEntry, ISODate } from "./rules/types";

export const FIX_LIMITS = { by: 80, work: 300 };

export type FixInput = { itemId: string; date: ISODate; by: string; work: string };

/** The point's condition once marked fixed, or why it can't be. */
export function fixEntry(
  prev: ConditionEntry | undefined,
  input: FixInput,
  today: ISODate,
  recordedBy: string | null,
  now = new Date().toISOString()
): { entry: ConditionEntry } | { error: string } {
  if (!prev || prev.s !== "fix") return { error: "That point isn’t marked Fix now." };
  const by = input.by.trim(), work = input.work.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Enter the date it was fixed." };
  if (input.date > today) return { error: "The date it was fixed can’t be in the future." };
  if (prev.d && input.date < prev.d) return { error: `It was found on ${prev.d}, so it can’t have been fixed before then.` };
  if (!by) return { error: "Say who fixed it." };
  if (!work) return { error: "Say what was done." };
  if (by.length > FIX_LIMITS.by || work.length > FIX_LIMITS.work) return { error: "Keep it short." };
  return {
    entry: {
      s: "ok",
      d: input.date,
      n: `Fixed by ${by}: ${work}`,
      p: [],
      t: prev.t,
      f: { by, work, recordedBy, recordedAt: now, was: { s: prev.s, d: prev.d, n: prev.n, i: prev.i } },
    },
  };
}

/** After an inspection is deleted: the rebuilt condition, with each fix kept where it's at
 *  least as new as what the remaining inspections say (a later check still wins). */
export function keepFixes(rebuilt: Record<string, ConditionEntry>, before: Record<string, ConditionEntry> | null | undefined): Record<string, ConditionEntry> {
  const out = { ...rebuilt };
  for (const [id, e] of Object.entries(before || {})) {
    if (!e || !e.f) continue;
    const r = out[id];
    if (!r || (r.d || "") <= (e.d || "")) out[id] = e;
  }
  return out;
}
