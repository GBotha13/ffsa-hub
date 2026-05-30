// FFSA Hub — Stripe payment provider (international cards, AmEx, wallets).
//
// Implements the PaymentProvider interface. We use Stripe Checkout
// (hosted) for shape-parity with PayFast: server creates a session,
// buyer is redirected to checkout.stripe.com, the source of truth
// is the server-to-server webhook (checkout.session.completed).
//
// Env:
//   STRIPE_SECRET_KEY      sk_live_... | sk_test_...
//   STRIPE_WEBHOOK_SECRET  whsec_...   (from Stripe Dashboard → Webhooks)
//   STRIPE_MODE            "test" | "live"  (optional; only used for logs)

import Stripe from "stripe";
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  PaymentStatus,
  WebhookRequest,
  WebhookResult,
} from "./provider";

type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  mode: "test" | "live";
};

let cached: { client: Stripe; cfg: StripeConfig } | null = null;

function loadConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey) {
    throw new Error(
      "Stripe is not configured — set STRIPE_SECRET_KEY in the environment."
    );
  }
  if (!webhookSecret) {
    throw new Error(
      "Stripe is not configured — set STRIPE_WEBHOOK_SECRET in the environment."
    );
  }
  return {
    secretKey,
    webhookSecret,
    mode: process.env.STRIPE_MODE === "live" ? "live" : "test",
  };
}

function getClient(): { client: Stripe; cfg: StripeConfig } {
  if (cached) return cached;
  const cfg = loadConfig();
  const client = new Stripe(cfg.secretKey, {
    // Pin the API version at build time so a Stripe-side default
    // change doesn't silently alter webhook payload shape.
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });
  cached = { client, cfg };
  return cached;
}

// Stripe permits a 5-min tolerance window between the webhook
// signature timestamp and now. We keep the SDK default.
const WEBHOOK_TOLERANCE_SECONDS = 300;

function mapStatus(event: Stripe.Event): PaymentStatus {
  switch (event.type) {
    case "checkout.session.completed":
      return "paid";
    case "checkout.session.async_payment_succeeded":
      return "paid";
    case "checkout.session.expired":
      return "cancelled";
    case "checkout.session.async_payment_failed":
      return "failed";
    default:
      return "pending";
  }
}

function extractOrderId(session: Stripe.Checkout.Session | null): string | null {
  if (!session) return null;
  if (typeof session.client_reference_id === "string" && session.client_reference_id) {
    return session.client_reference_id;
  }
  const meta = session.metadata?.order_id;
  return typeof meta === "string" && meta ? meta : null;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const { client } = getClient();

    const session = await client.checkout.sessions.create({
      mode: "payment",
      // Stripe accepts USD/EUR/GBP/ZAR/etc. ZAR keeps prices identical
      // to the PayFast flow.
      currency: req.currency.toLowerCase(),
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            product_data: {
              name: req.description.slice(0, 250),
            },
            // Stripe takes the unit amount in the currency's smallest
            // unit. ZAR is 100 cents per rand — same units we already
            // use across orders.total_cents.
            unit_amount: req.amountCents,
          },
        },
      ],
      customer_email: req.buyer.email,
      // Round-trip identifier — both fields set so the webhook can
      // recover the order id regardless of which the buyer sees.
      client_reference_id: req.orderId,
      metadata: { order_id: req.orderId },
      success_url: req.returnUrl,
      cancel_url: req.cancelUrl,
      // Tighter timeout than Stripe's default (24h) so abandoned
      // inventory holds release sooner.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
    });

    if (!session.url) {
      throw new Error("Stripe returned no checkout URL.");
    }
    return { redirectUrl: session.url, reference: session.id };
  },

  async verifyWebhook(req: WebhookRequest): Promise<WebhookResult> {
    const { client, cfg } = getClient();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("Stripe webhook rejected: missing stripe-signature header.");
    }

    let event: Stripe.Event;
    try {
      event = client.webhooks.constructEvent(
        req.rawBody,
        signature,
        cfg.webhookSecret,
        WEBHOOK_TOLERANCE_SECONDS
      );
    } catch (err) {
      throw new Error(
        `Stripe webhook rejected: ${err instanceof Error ? err.message : "signature verification failed"}.`
      );
    }

    const session =
      event.data.object && (event.data.object as Stripe.Checkout.Session).object === "checkout.session"
        ? (event.data.object as Stripe.Checkout.Session)
        : null;

    const orderId = extractOrderId(session);
    if (!orderId) {
      throw new Error(
        `Stripe webhook rejected: no order id on event ${event.type}.`
      );
    }

    const amountCents =
      session?.amount_total != null ? session.amount_total : null;

    return {
      orderId,
      status: mapStatus(event),
      providerPaymentId:
        typeof session?.payment_intent === "string"
          ? session.payment_intent
          : session?.payment_intent?.id ?? session?.id ?? null,
      amountCents,
    };
  },
};
