/**
 * Deterministic color assignment for labels.
 *
 * If labels.color is set explicitly (hex), use it. Otherwise hash the slug
 * and pick from a curated palette so every label gets a stable, distinct
 * color without manual configuration.
 *
 * Returns { bg, text, border } as hex strings suitable for inline styles.
 * Inline styles dodge Tailwind's purge rules (otherwise we'd have to
 * enumerate every possible bg-{color}-100 / text-{color}-800 class).
 */

// 18 distinct, balanced hues. Pastel bg + saturated text for legibility.
const PALETTE: ReadonlyArray<{ bg: string; text: string; border: string }> = [
  { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" }, // red
  { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" }, // orange
  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" }, // amber
  { bg: "#fef9c3", text: "#854d0e", border: "#fde047" }, // yellow
  { bg: "#ecfccb", text: "#3f6212", border: "#bef264" }, // lime
  { bg: "#dcfce7", text: "#166534", border: "#86efac" }, // green
  { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" }, // emerald
  { bg: "#ccfbf1", text: "#115e59", border: "#5eead4" }, // teal
  { bg: "#cffafe", text: "#155e75", border: "#67e8f9" }, // cyan
  { bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" }, // sky
  { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" }, // blue
  { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" }, // indigo
  { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" }, // violet
  { bg: "#f3e8ff", text: "#6b21a8", border: "#d8b4fe" }, // purple
  { bg: "#fae8ff", text: "#86198f", border: "#f0abfc" }, // fuchsia
  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" }, // pink
  { bg: "#ffe4e6", text: "#9f1239", border: "#fda4af" }, // rose
  { bg: "#e7e5e4", text: "#44403c", border: "#d6d3d1" }, // stone
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type LabelColors = { bg: string; text: string; border: string };

export function getLabelColors(label: {
  slug?: string | null;
  color?: string | null;
}): LabelColors {
  // Custom hex override: use as bg, derive text/border by lightening rules.
  if (label.color && /^#[0-9a-fA-F]{6}$/.test(label.color)) {
    return { bg: label.color, text: "#1f2937", border: label.color };
  }
  const key = label.slug ?? "";
  return PALETTE[hash(key) % PALETTE.length];
}
