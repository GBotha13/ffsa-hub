// Helpers for resolving a person's display name when the typed columns
// (library_persons.first_name / last_name) didn't capture everything —
// e.g. the CSV had a "Last Name" column that wasn't mapped at import
// time, so the value still lives in raw_data.

import { prettifyKey } from "@/lib/csv-sheet";

const FIRST_NAME_KEYS = [
  "first name",
  "given name",
  "firstname",
  "given",
  "preferred name",
  "preferred first name",
];

const LAST_NAME_KEYS = [
  "last name",
  "surname",
  "family name",
  "lastname",
  "lastname/surname",
];

const PREFERRED_NAME_KEYS = [
  "preferred name",
  "preferred first name",
  "nickname",
  "preferred",
];

function findInRaw(raw: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!raw || typeof raw !== "object") return null;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed || trimmed.toLowerCase() === "null") continue;
    const pretty = prettifyKey(k).toLowerCase();
    if (keys.includes(pretty)) return trimmed;
  }
  return null;
}

export type NameSource = {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  raw_data?: Record<string, unknown> | null;
};

/**
 * Best-effort full display name for a library_person (or contact-like
 * shape). Pulls from typed columns first, then falls back to raw_data
 * for any "Last Name" / "Surname" column that wasn't mapped at import
 * time. If nothing usable exists, returns the email address, then an
 * em dash.
 */
export function bestPersonName(p: NameSource): string {
  const firstTyped = (p.first_name ?? "").trim() || null;
  const lastTyped = (p.last_name ?? "").trim() || null;
  const preferred = (p.preferred_name ?? "").trim() || null;

  const first = firstTyped ?? findInRaw(p.raw_data, FIRST_NAME_KEYS);
  const last = lastTyped ?? findInRaw(p.raw_data, LAST_NAME_KEYS);
  const pref =
    preferred ?? findInRaw(p.raw_data, PREFERRED_NAME_KEYS);

  // Display: "Preferred (Legal) Last" if a preferred name exists and differs,
  // else "First Last". Falls back through email / dash.
  const display = pref && first && pref.toLowerCase() !== first.toLowerCase()
    ? [pref, last].filter(Boolean).join(" ")
    : [first, last].filter(Boolean).join(" ");
  if (display) return display;
  if (p.email && p.email.trim()) return p.email.trim();
  return "—";
}
