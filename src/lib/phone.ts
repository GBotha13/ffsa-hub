import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalize a raw phone string to E.164 (e.g. +27821234567).
 * Returns null if the input is empty, invalid, or too short to be useful for dedup.
 *
 * defaultRegion is used when the input has no country code prefix.
 * The CRM uses 'ZA' as the default to match the org's primary geography.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultRegion: CountryCode = "ZA"
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed || !parsed.isValid()) return null;

  const e164 = parsed.number;
  // The contacts.phone_normalized CHECK constraint requires +[1-9][0-9]{6,14}.
  // libphonenumber's output already conforms to this when isValid() is true.
  return e164;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}
