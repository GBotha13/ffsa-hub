import crypto from "crypto";

// ============================================================
// Signed preferences tokens — HMAC-SHA256.
// Payload: { c: contactId, cmp: campaignId|null, exp: epochSeconds }
// Embedded in campaign email footers; verified by the public
// /unsubscribe and /preferences pages. 30-day expiry.
//
// The campaign id is optional and carries audience context so
// the preferences page can highlight which labels sent this
// particular email (the recipient still sees / can edit all of
// their labels — campaign context is just a visual hint).
// ============================================================

type Payload = { c: string; cmp: string | null; exp: number };

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

export function signPrefsToken(
  contactId: string,
  campaignId: string | null
): string {
  const payload: Payload = {
    c: contactId,
    cmp: campaignId,
    exp: Math.floor(Date.now() / 1000) + THIRTY_DAYS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyPrefsToken(
  token: string
): { valid: boolean; contactId?: string; campaignId?: string | null; reason?: string } {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [body, sig] = parts;

  const expected = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
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
  return {
    valid: true,
    contactId: payload.c,
    campaignId: payload.cmp ?? null,
  };
}
