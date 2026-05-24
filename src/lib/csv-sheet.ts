// Helpers for rendering library_persons.raw_data (a JSONB blob of the
// original CSV row) as a readable form-response sheet.

export type SheetEntry = {
  key: string;
  label: string;
  value: string | null;
  order: number;
  long: boolean;
};

/**
 * Strip the leading question number ("1. ", "33b. ", "_1. "), HTML tags,
 * and common HTML entities from a CSV column name so it reads like a
 * human-friendly form field label.
 */
export function prettifyKey(key: string): string {
  return (key ?? "")
    .replace(/^_?\d+[a-z]?\.\s*/, "") // "12. ", "33b. ", "_1. "
    .replace(/^_+/, "") // bare leading underscores like "_1"
    .replace(/&nbsp;|&#xa0;|&#160;/gi, " ")
    .replace(/<\/?em>|<\/?strong>|<\/?b>|<\/?i>|<\/?p>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function leadingNumber(key: string): number {
  const m = /^_?(\d+)([a-z]?)\./.exec(key ?? "");
  if (!m) return Number.MAX_SAFE_INTEGER; // unnumbered fields go last
  const base = parseInt(m[1], 10);
  const suffix = m[2] ? m[2].charCodeAt(0) - 96 : 0; // 'b' = 2, etc.
  return base * 100 + suffix;
}

function normaliseValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Turn raw_data into a sorted, prettified list of entries ready for rendering.
 * Sort respects the original form question order (1, 2, 3, ..., 12, 13...).
 */
export function toSheetEntries(raw: Record<string, unknown> | null | undefined): SheetEntry[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .map<SheetEntry>(([key, rawValue]) => {
      const value = normaliseValue(rawValue);
      const label = prettifyKey(key);
      return {
        key,
        label,
        value,
        order: leadingNumber(key),
        long: !!value && value.length > 80,
      };
    })
    .filter((e) => e.label.length > 0)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}
