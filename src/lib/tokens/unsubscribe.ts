import crypto from "crypto";

// ============================================================
// Signed unsubscribe tokens — HMAC-SHA256.
// Payload: { c: contactId, l: labelId|null, exp: epochSeconds }
// Embedded in campaign email footers; verified by the public
// /unsubscribe page. 30-day expiry.
// ============================================================

type Payload = { c: string; l: string | null; exp: number };

function secret(): string {
  const s = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_TOKEN_SECRET is not configured");
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export function signUnsubscribeToken(
  contactId: string,
  labelId: string | null
): string {
  const payload: Payload = {
    c: contactId,
    l: labelId,
    exp: Math.floor(Date.now() / 1000) + THIRTY_DAYS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

// ── Contact-scoped preferences token ────────────────────────
// Identifies a contact for the public /preferences page. Same
// HMAC scheme; the payload's `l` field carries the marker
// "__prefs__" so it can't be mistaken for an unsubscribe token.
const PREFS_MARKER = "__prefs__";

export function signPreferencesToken(contactId: string): string {
  const payload: Payload = {
    c: contactId,
    l: PREFS_MARKER,
    exp: Math.floor(Date.now() / 1000) + THIRTY_DAYS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyPreferencesToken(
  token: string
): { valid: boolean; contactId?: string; reason?: string } {
  const v = verifyUnsubscribeToken(token);
  if (!v.valid) return { valid: false, reason: v.reason };
  if (v.labelId !== PREFS_MARKER) {
    return { valid: false, reason: "not a preferences token" };
  }
  return { valid: true, contactId: v.contactId };
}

export function verifyUnsubscribeToken(
  token: string
): { valid: boolean; contactId?: string; labelId?: string | null; reason?: string } {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [body, sig] = parts;

  const expected = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  // Constant-time compare.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad signature" };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { valid: false, reason: "bad payload" };
  }
  if (!payload.c || typeof payload.exp !== "number") {
    return { valid: false, reason: "bad payload" };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, contactId: payload.c, labelId: payload.l };
}
