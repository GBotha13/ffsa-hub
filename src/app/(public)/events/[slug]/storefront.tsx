"use client";

import { useMemo, useState } from "react";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  pricing_mode: string;
  display_price_cents: number;
  target_net_cents: number;
  capacity: number | null;
  quantity_sold: number;
  max_per_order: number | null;
  sales_start_at: string | null;
  sales_end_at: string | null;
};

type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  logo_url: string | null;
};

type LineItem = {
  ticketTypeId: string;
  qty: number;
  // For pwyw tiers: the buyer's chosen per-ticket amount in cents.
  pwywAmountCents: number | null;
};

const ACCENT = "#1d4ed8";

function rands(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

function isOnSale(t: TicketType, now: Date): boolean {
  if (t.sales_start_at && new Date(t.sales_start_at) > now) return false;
  if (t.sales_end_at && new Date(t.sales_end_at) <= now) return false;
  if (t.capacity != null && t.quantity_sold >= t.capacity) return false;
  return true;
}

function remaining(t: TicketType): number | null {
  if (t.capacity == null) return null;
  return Math.max(0, t.capacity - t.quantity_sold);
}

export function Storefront({
  event,
  ticketTypes,
}: {
  event: PublicEvent;
  ticketTypes: TicketType[];
}) {
  const now = useMemo(() => new Date(), []);
  const [lines, setLines] = useState<Record<string, LineItem>>({});
  const [donationRands, setDonationRands] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setQty(t: TicketType, qty: number) {
    setLines((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[t.id];
      } else {
        const cap = t.max_per_order ?? Infinity;
        const rem = remaining(t) ?? Infinity;
        const clamped = Math.min(qty, cap, rem);
        const existing = prev[t.id];
        next[t.id] = {
          ticketTypeId: t.id,
          qty: clamped,
          pwywAmountCents:
            t.pricing_mode === "pwyw"
              ? existing?.pwywAmountCents ?? t.display_price_cents
              : null,
        };
      }
      return next;
    });
  }

  function setPwywAmount(t: TicketType, value: string) {
    setLines((prev) => {
      const existing = prev[t.id];
      if (!existing) return prev;
      const cents = Math.max(
        t.display_price_cents,
        Math.round((Number.parseFloat(value) || 0) * 100)
      );
      return { ...prev, [t.id]: { ...existing, pwywAmountCents: cents } };
    });
  }

  const subtotalCents = Object.values(lines).reduce((sum, line) => {
    const tt = ticketTypes.find((x) => x.id === line.ticketTypeId);
    if (!tt) return sum;
    const per = line.pwywAmountCents ?? tt.display_price_cents;
    return sum + per * line.qty;
  }, 0);

  const donationCents = Math.max(
    0,
    Math.round((Number.parseFloat(donationRands) || 0) * 100)
  );
  const totalCents = subtotalCents + donationCents;
  const lineCount = Object.values(lines).reduce((s, l) => s + l.qty, 0);

  const buyerValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit() {
    if (lineCount === 0) {
      setErr("Add at least one ticket.");
      return;
    }
    if (!buyerValid) {
      setErr("Please complete your name and a valid email.");
      return;
    }
    setSubmitting(true);
    setErr(null);

    const res = await fetch(`/api/events/${event.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: Object.values(lines).map((l) => ({
          ticket_type_id: l.ticketTypeId,
          qty: l.qty,
          pwyw_amount_cents: l.pwywAmountCents,
        })),
        donation_cents: donationCents,
        promo_code: promoCode.trim() || null,
        buyer: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        },
        marketing_consent: marketingConsent,
        payment_provider: "payfast",
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Couldn't start checkout. Please try again.");
      return;
    }
    const result = (await res.json()) as { redirectUrl?: string };
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    setErr("Checkout returned no redirect URL.");
  }

  const dateRange =
    event.end_date && event.end_date !== event.start_date
      ? `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`
      : formatDate(event.start_date);
  const timeRange =
    event.start_time && event.end_time
      ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
      : event.start_time
        ? formatTime(event.start_time)
        : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflowY: "auto",
        background: "linear-gradient(180deg,#f8fafc 0%,#eef1f5 100%)",
        colorScheme: "light",
      }}
    >
      <div className="min-h-full flex justify-center px-4 py-10">
        <div className="w-full max-w-[680px]">
          {/* Event header */}
          <div className="rounded-2xl overflow-hidden mb-5" style={cardStyle}>
            <div style={{ height: 5, backgroundColor: ACCENT }} />
            <div className="px-7 sm:px-9 pt-7 pb-6">
              {event.logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={event.logo_url} alt="" className="h-12 object-contain mb-4" />
              )}
              <h1
                className="text-[28px] font-bold tracking-tight leading-tight"
                style={{ color: "#0f172a" }}
              >
                {event.title}
              </h1>
              <p className="text-sm mt-2" style={{ color: "#475569" }}>
                {dateRange}
                {timeRange ? ` · ${timeRange}` : ""}
                {event.location ? ` · ${event.location}` : ""}
              </p>
              {event.description && (
                <p
                  className="text-sm mt-4 whitespace-pre-wrap"
                  style={{ color: "#334155" }}
                >
                  {event.description}
                </p>
              )}
            </div>
          </div>

          {/* Ticket tiers */}
          <div className="rounded-2xl overflow-hidden mb-5" style={cardStyle}>
            <div className="px-7 sm:px-9 pt-6 pb-7">
              <h2
                className="text-[15px] font-semibold tracking-tight mb-1"
                style={{ color: "#0f172a" }}
              >
                Tickets
              </h2>
              {ticketTypes.length === 0 ? (
                <p className="text-sm mt-3" style={{ color: "#64748b" }}>
                  No tickets available right now. Please check back soon.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {ticketTypes.map((t) => {
                    const onSale = isOnSale(t, now);
                    const rem = remaining(t);
                    const line = lines[t.id];
                    const qty = line?.qty ?? 0;
                    const isPwyw = t.pricing_mode === "pwyw";
                    return (
                      <li key={t.id} className="rounded-xl" style={tierStyle}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className="text-sm font-semibold"
                                style={{ color: "#0f172a" }}
                              >
                                {t.name}
                              </p>
                              {isPwyw && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `${ACCENT}14`,
                                    color: ACCENT,
                                  }}
                                >
                                  pay what you want
                                </span>
                              )}
                              {!onSale && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: "#fee2e2",
                                    color: "#b91c1c",
                                  }}
                                >
                                  {rem === 0 ? "sold out" : "not on sale"}
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p
                                className="text-xs mt-1"
                                style={{ color: "#64748b" }}
                              >
                                {t.description}
                              </p>
                            )}
                            <p
                              className="text-sm mt-1.5"
                              style={{ color: "#334155" }}
                            >
                              {isPwyw
                                ? `Minimum ${rands(t.display_price_cents)}`
                                : rands(t.display_price_cents)}
                              {rem != null && rem > 0 && rem <= 10 && (
                                <span
                                  className="text-xs ml-2"
                                  style={{ color: "#b45309" }}
                                >
                                  only {rem} left
                                </span>
                              )}
                            </p>
                          </div>
                          {onSale && !isPwyw && (
                            <QtyStepper
                              qty={qty}
                              onChange={(n) => setQty(t, n)}
                              max={Math.min(t.max_per_order ?? 99, rem ?? 99)}
                            />
                          )}
                          {onSale &&
                            isPwyw &&
                            (qty === 0 ? (
                              <button
                                type="button"
                                className="text-sm font-semibold px-4 py-2 rounded-xl text-white"
                                style={{ backgroundColor: ACCENT }}
                                onClick={() => setQty(t, 1)}
                              >
                                Add
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-sm font-medium px-3 py-2 rounded-xl"
                                style={{ color: "#64748b" }}
                                onClick={() => setQty(t, 0)}
                              >
                                Remove
                              </button>
                            ))}
                        </div>
                        {isPwyw && qty > 0 && (
                          <div className="mt-3">
                            <label
                              className="block text-xs font-medium mb-1"
                              style={{ color: "#475569" }}
                            >
                              Amount (ZAR)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min={t.display_price_cents / 100}
                              defaultValue={(t.display_price_cents / 100).toFixed(2)}
                              onChange={(e) => setPwywAmount(t, e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 text-sm"
                              style={inputStyle}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Promo + donation */}
          {ticketTypes.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-5" style={cardStyle}>
              <div className="px-7 sm:px-9 pt-6 pb-7 space-y-4">
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "#334155" }}
                  >
                    Promo or comp code (optional)
                  </label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "#334155" }}
                  >
                    Add a gift (ZAR, optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={donationRands}
                    onChange={(e) => setDonationRands(e.target.value)}
                    placeholder="0.00"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Total */}
          {lineCount > 0 && (
            <div className="rounded-2xl overflow-hidden mb-5" style={cardStyle}>
              <div className="px-7 sm:px-9 pt-5 pb-5 flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "#475569" }}>
                  Total
                </span>
                <span className="text-xl font-bold" style={{ color: "#0f172a" }}>
                  {rands(totalCents)}
                </span>
              </div>
            </div>
          )}

          {/* Buyer details */}
          {lineCount > 0 && (
            <div className="rounded-2xl overflow-hidden mb-5" style={cardStyle}>
              <div className="px-7 sm:px-9 pt-6 pb-7 space-y-4">
                <h2
                  className="text-[15px] font-semibold tracking-tight"
                  style={{ color: "#0f172a" }}
                >
                  Your details
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <Labelled label="First name *">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Labelled>
                  <Labelled label="Last name *">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Labelled>
                </div>
                <Labelled label="Email *">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </Labelled>
                <Labelled label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </Labelled>
                <label
                  className="flex items-start gap-2 text-sm"
                  style={{ color: "#334155" }}
                >
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5"
                    style={{ accentColor: ACCENT }}
                  />
                  <span>
                    Keep me posted on FFSA events and gatherings by email.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Pay */}
          {lineCount > 0 && (
            <div className="rounded-2xl overflow-hidden mb-5" style={cardStyle}>
              <div className="px-7 sm:px-9 pt-5 pb-6">
                <p className="text-xs mb-3" style={{ color: "#64748b" }}>
                  You'll be redirected to PayFast (South African card) to complete
                  payment securely.
                </p>
                {err && (
                  <p
                    className="text-sm mb-3 rounded-lg px-3 py-2"
                    style={{ color: "#b91c1c", backgroundColor: "#fef2f2" }}
                  >
                    {err}
                  </p>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !buyerValid}
                  className="w-full text-sm font-semibold text-white rounded-xl"
                  style={{
                    backgroundColor: ACCENT,
                    padding: "13px",
                    opacity: submitting || !buyerValid ? 0.6 : 1,
                    boxShadow: `0 6px 16px -6px ${ACCENT}80`,
                  }}
                >
                  {submitting ? "Starting payment…" : `Pay ${rands(totalCents)} →`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Small helpers + styles
// ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#0f172a",
  boxShadow:
    "0 1px 2px rgba(15,23,42,.04), 0 12px 32px -12px rgba(15,23,42,.18)",
  border: "1px solid #eef1f5",
};

const tierStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  padding: "16px",
  backgroundColor: "#ffffff",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#0f172a",
  borderColor: "#e2e8f0",
};

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5"
        style={{ color: "#334155" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function QtyStepper({
  qty,
  onChange,
  max,
}: {
  qty: number;
  onChange: (n: number) => void;
  max: number;
}) {
  return (
    <div
      className="flex items-center gap-1 border rounded-lg"
      style={{ borderColor: "#e2e8f0" }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, qty - 1))}
        disabled={qty === 0}
        className="w-8 h-9 text-base disabled:opacity-30"
        style={{ color: "#475569" }}
      >
        −
      </button>
      <span
        className="text-sm font-semibold w-6 text-center"
        style={{ color: "#0f172a" }}
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, qty + 1))}
        disabled={qty >= max}
        className="w-8 h-9 text-base disabled:opacity-30"
        style={{ color: "#475569" }}
      >
        +
      </button>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(Number.parseInt(h, 10), Number.parseInt(m, 10));
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
