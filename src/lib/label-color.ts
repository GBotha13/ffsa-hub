/**
 * Deterministic color assignment for labels.
 *
 * If labels.color is set explicitly (hex), use it. Otherwise hash the slug
 * with FNV-1a (better distribution than a 31-multiplier hash) and pick
 * from a curated palette ordered to maximize hue distance between
 * adjacent entries — so even when the hash collides on neighbors, the
 * chosen colors look distinct.
 *
 * Returns { bg, text, border } as hex strings suitable for inline styles.
 * Inline styles dodge Tailwind's purge rules.
 */

// 16 hues interleaved warm/cool/contrast so consecutive indices look
// distinct. Pastel bg + saturated text for legibility on light & dark.
export const LABEL_PALETTE: ReadonlyArray<{ bg: string; text: string; border: string }> = [
  { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" }, // 0  red
  { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" }, // 1  blue
  { bg: "#dcfce7", text: "#166534", border: "#86efac" }, // 2  green
  { bg: "#f3e8ff", text: "#6b21a8", border: "#d8b4fe" }, // 3  purple
  { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" }, // 4  orange
  { bg: "#cffafe", text: "#155e75", border: "#67e8f9" }, // 5  cyan
  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" }, // 6  pink
  { bg: "#ccfbf1", text: "#115e59", border: "#5eead4" }, // 7  teal
  { bg: "#fef9c3", text: "#854d0e", border: "#fde047" }, // 8  yellow
  { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" }, // 9  violet
  { bg: "#ecfccb", text: "#3f6212", border: "#bef264" }, // 10 lime
  { bg: "#ffe4e6", text: "#9f1239", border: "#fda4af" }, // 11 rose
  { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" }, // 12 indigo
  { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" }, // 13 emerald
  { bg: "#fae8ff", text: "#86198f", border: "#f0abfc" }, // 14 fuchsia
  { bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" }, // 15 sky
];

// FNV-1a 32-bit. Better distribution on similar-prefix slugs than the
// schoolbook (h * 31 + ch) hash, which can collide adjacent labels.
function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export type LabelColors = { bg: string; text: string; border: string };

export function getLabelColors(label: {
  slug?: string | null;
  color?: string | null;
}): LabelColors {
  if (label.color && /^#[0-9a-fA-F]{6}$/.test(label.color)) {
    // If the stored color matches a palette bg, return the full triplet
    // (bg + text + border) for nicer rendering. Otherwise treat as custom.
    const match = LABEL_PALETTE.find(
      (p) => p.bg.toLowerCase() === label.color!.toLowerCase()
    );
    if (match) return match;
    return { bg: label.color, text: "#1f2937", border: label.color };
  }
  const key = label.slug ?? "";
  return LABEL_PALETTE[hash(key) % LABEL_PALETTE.length];
}
