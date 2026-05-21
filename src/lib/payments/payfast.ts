// FFSA Hub — PayFast payment provider (South African cards).
//
// PayFast has no SDK: checkout is a signed redirect to PayFast's
// hosted page, and confirmation arrives as a server-to-server
// ITN (Instant Transaction Notification) POST. This adapter
// implements the PaymentProvider interface for PayFast.
//
// PayFast's signature is fussy about field order and character
// escaping — exercise this against the PayFast SANDBOX
// (PAYFAST_MODE=sandbox) before any live use.

import { createHash } from "node:crypto";
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  PaymentStatus,
  WebhookRequest,
  WebhookResult,
} from "./provider";

const ENDPOINTS = {
  sandbox: {
    process: "https://sandbox.payfast.co.za/eng/process",
    validate: "https://sandbox.payfast.co.za/eng/query/validate",
  },
  live: {
    process: "https://www.payfast.co.za/eng/process",
    validate: "https://www.payfast.co.za/eng/query/validate",
  },
} as const;

type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  mode: "sandbox" | "live";
};

function loadConfig(): PayfastConfig {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) {
    throw new Error(
      "PayFast is not configured — set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY.",
    );
  }
  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE ?? "",
    mode: process.env.PAYFAST_MODE === "live" ? "live" : "sandbox",
  };
}

// PayFast signs values with PHP urlencode() semantics: spaces as
// "+", uppercase percent-encoding, the same escaped character set.
// encodeURIComponent already uppercases its hex; we fix spaces and
// the handful of characters it leaves bare.
function payfastEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// MD5 of "name=value&..." in the given order, with the passphrase
// (if any) appended last. PayFast signs both checkout requests and
// ITNs this way.
function signature(pairs: [string, string][], passphrase: string): string {
  const parts = pairs.map(([k, v]) => `${k}=${payfastEncode(v)}`);
  if (passphrase) parts.push(`passphrase=${payfastEncode(passphrase)}`);
  return createHash("md5").update(parts.join("&")).digest("hex");
}

function toRands(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function mapStatus(raw: string | null): PaymentStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "COMPLETE":
      return "paid";
    case "CANCELLED":
      return "cancelled";
    case "PENDING":
      return "pending";
    default:
      return "failed";
  }
}

export const payfastProvider: PaymentProvider = {
  name: "payfast",

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const cfg = loadConfig();

    // Field order matters — PayFast signs fields in submission order.
    const pairs: [string, string][] = [
      ["merchant_id", cfg.merchantId],
      ["merchant_key", cfg.merchantKey],
      ["return_url", req.returnUrl],
      ["cancel_url", req.cancelUrl],
      ["notify_url", req.notifyUrl],
      ["name_first", req.buyer.firstName],
      ["name_last", req.buyer.lastName],
      ["email_address", req.buyer.email],
      ["m_payment_id", req.orderId],
      ["amount", toRands(req.amountCents)],
      ["item_name", req.description],
    ];

    const query = pairs
      .map(([k, v]) => `${k}=${payfastEncode(v)}`)
      .concat(`signature=${signature(pairs, cfg.passphrase)}`)
      .join("&");

    return {
      redirectUrl: `${ENDPOINTS[cfg.mode].process}?${query}`,
      reference: req.orderId,
    };
  },

  async verifyWebhook(req: WebhookRequest): Promise<WebhookResult> {
    const cfg = loadConfig();
    const posted = new URLSearchParams(req.rawBody);

    // Recompute the signature over every posted field except
    // `signature`, in the order received.
    const signedPairs: [string, string][] = [];
    posted.forEach((value, key) => {
      if (key !== "signature") signedPairs.push([key, value]);
    });
    if (signature(signedPairs, cfg.passphrase) !== (posted.get("signature") ?? "")) {
      throw new Error("PayFast ITN rejected: signature mismatch.");
    }

    // Server-to-server postback — PayFast itself must confirm it
    // sent this exact payload.
    const postback = await fetch(ENDPOINTS[cfg.mode].validate, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: req.rawBody,
    });
    const verdict = (await postback.text().catch(() => "")).trim();
    if (verdict !== "VALID") {
      throw new Error(`PayFast ITN rejected: postback returned "${verdict}".`);
    }

    const orderId = posted.get("m_payment_id");
    if (!orderId) {
      throw new Error("PayFast ITN rejected: missing m_payment_id.");
    }

    const gross = posted.get("amount_gross");
    return {
      orderId,
      status: mapStatus(posted.get("payment_status")),
      providerPaymentId: posted.get("pf_payment_id"),
      amountCents: gross ? Math.round(Number.parseFloat(gross) * 100) : null,
    };
  },
};
