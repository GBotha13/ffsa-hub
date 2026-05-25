import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalize a raw phone string to E.164 (e.g. +27821234567).
 *
 * Always returns a value starting with "+" when possible, or null only if
 * the input has too few/too many digits to be a real number.
 *
 * Inference handles common dirty patterns:
 *  - "+27821234567"     → +27821234567 (already E.164)
 *  - "0821234567"       → +27821234567 (ZA local with leading 0)
 *  - "821234567"        → +27821234567 (ZA local without leading 0)
 *  - "27821234567"      → +27821234567 (international without +)
 *  - "270821234567"     → +27821234567 (HubSpot export: CC + local-with-0)
 *  - "16162187556"      → +16162187556 (US international without +)
 *
 * defaultRegion is used for ambiguous local-format inputs (no country code
 * present). The CRM uses ZA to match the org's primary geography.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultRegion: CountryCode = "ZA"
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Try as-is — handles already-formatted +E.164, ZA local with leading 0,
  //    and most cases libphonenumber understands.
  const direct = tryParse(trimmed, defaultRegion);
  if (direct) return direct;

  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/^\+/, "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  // If they typed a + already and libphonenumber rejected it, no inference
  // is going to help — return null rather than guess at a different country.
  if (hadPlus) return null;

  const candidates: string[] = [];

  // 2. Plain "prepend +" — handles "27821234567" → "+27821234567",
  //    "16162187556" → "+16162187556".
  candidates.push("+" + digits);

  // 3. HubSpot-style dirty export: country code + 0-prefixed local number.
  //    e.g. 270821234567 (12 digits) → +27 821234567.
  if (digits.startsWith("27") && digits[2] === "0" && digits.length >= 11) {
    candidates.push("+27" + digits.slice(3));
  }
  for (const [cc, ccLen] of [["1", 1], ["44", 2], ["61", 2], ["64", 2]] as const) {
    if (
      digits.startsWith(cc) &&
      digits[ccLen] === "0" &&
      digits.length >= ccLen + 10
    ) {
      candidates.push("+" + cc + digits.slice(ccLen + 1));
    }
  }

  for (const candidate of candidates) {
    const parsed = tryParse(candidate, defaultRegion);
    if (parsed) return parsed;
  }

  // 4. Fallback: treat the whole thing as a local number in defaultRegion,
  //    stripping any leading zeros. libphonenumber will add the country code.
  const stripped = digits.replace(/^0+/, "");
  if (stripped.length >= 7) {
    const fallback = tryParse(stripped, defaultRegion);
    if (fallback) return fallback;
  }

  return null;
}

function tryParse(input: string, region: CountryCode): string | null {
  const p = parsePhoneNumberFromString(input, region);
  if (!p || !p.isValid()) return null;
  return p.number;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}
