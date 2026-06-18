import crypto from "crypto";

// ============================================================
// Signed email-change tokens — HMAC-SHA256.
// Payload: { p: "email-change", u: userId, e: newEmail, exp: epochSeconds }
// Emailed to the NEW address; verified by /api/account/confirm-email.
// 1-hour expiry. The `p` (purpose) field namespaces these tokens so an
// unsubscribe token can never be replayed as an email-change token.
// ============================================================

type Payload = { p: "email-change"; u: string; e: string; exp: number };

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

const ONE_HOUR = 60 * 60;

export function signEmailChangeToken(userId: string, newEmail: string): string {
  const payload: Payload = {
    p: "email-change",
    u: userId,
    e: newEmail.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ONE_HOUR,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyEmailChangeToken(
  token: string
): { valid: boolean; userId?: string; newEmail?: string; reason?: string } {
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
  if (payload.p !== "email-change" || !payload.u || !payload.e) {
    return { valid: false, reason: "bad payload" };
  }
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, userId: payload.u, newEmail: payload.e };
}
