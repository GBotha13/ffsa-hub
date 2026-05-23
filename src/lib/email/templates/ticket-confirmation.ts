// FFSA Hub — Ticket confirmation email (transactional).
//
// Inline-CSS HTML for broad email-client support. QR codes are
// embedded as data URIs so the recipient doesn't need to hit a
// server to see them.

export function ticketConfirmationEmailHtml(opts: {
  buyerFirstName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  tickets: Array<{ code: string; tierName: string; qrDataUrl: string }>;
  orderId: string;
  totalCents: number;
}): string {
  const rands = (cents: number) => `R${(cents / 100).toFixed(2)}`;

  const ticketsHtml = opts.tickets
    .map(
      (t, i) => `
      <tr>
        <td style="padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;text-align:center;">
          <img src="${t.qrDataUrl}" alt="Ticket ${i + 1} QR" width="220" height="220" style="display:block;margin:0 auto;" />
          <p style="margin:14px 0 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;">Ticket ${i + 1} of ${opts.tickets.length}</p>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(t.tierName)}</p>
          <p style="margin:6px 0 0 0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;color:#94a3b8;">${escapeHtml(t.code)}</p>
        </td>
      </tr>
      <tr><td style="height:14px;line-height:14px;">&nbsp;</td></tr>`
    )
    .join("");

  const ticketsCount = opts.tickets.length;
  const ticketWord = ticketsCount > 1 ? "tickets are" : "ticket is";
  const qrPlural = ticketsCount > 1 ? "codes" : "code";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="height:5px;background:#1d4ed8;line-height:5px;font-size:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#1d4ed8;letter-spacing:0.09em;text-transform:uppercase;">Your tickets</p>
            <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.25;color:#0f172a;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(opts.eventTitle)}</h1>
            <p style="margin:6px 0 0 0;font-size:14px;color:#475569;">${escapeHtml(opts.eventDate)}${opts.eventLocation ? ` · ${escapeHtml(opts.eventLocation)}` : ""}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 0 32px;">
            <p style="margin:0;font-size:15px;color:#334155;line-height:1.55;">Hi ${escapeHtml(opts.buyerFirstName)}, your ${ticketsCount} ${ticketWord} confirmed. Show the QR ${qrPlural} below at the door.</p>
          </td>
        </tr>
        <tr><td style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              ${ticketsHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px 32px;border-top:1px solid #f1f5f9;">
            <p style="margin:14px 0 4px 0;font-size:13px;color:#64748b;">Order #${escapeHtml(opts.orderId.slice(0, 8))} · Total ${rands(opts.totalCents)}</p>
            <p style="margin:8px 0 0 0;font-size:13px;color:#94a3b8;">Questions? Reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
