function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function schedulingRequestEmailHtml({
  firstName,
  senderName,
  durationMinutes,
  expiresAt,
  message,
  magicLinkUrl,
}: {
  firstName: string;
  senderName: string;
  durationMinutes: number;
  expiresAt: string;
  message?: string | null;
  magicLinkUrl: string;
}): string {
  const expiresFormatted = new Date(expiresAt).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const messageBlock = message
    ? `<p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;font-style:italic;">&ldquo;${esc(message)}&rdquo;</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Let's connect</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0B09;font-family:'Roboto',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0B09;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#141210;border:1px solid #2a2420;border-radius:14px;overflow:hidden;">
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#F5C518,transparent);"></td></tr>
        <tr><td align="center" style="padding:40px 40px 32px;">
          <div style="font-size:28px;font-weight:900;letter-spacing:0.06em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1;">FIRE &amp; FRAGRANCE</div>
          <div style="margin-top:8px;">
            <span style="font-size:9px;letter-spacing:0.3em;font-weight:700;color:#F5C518;text-transform:uppercase;">South Africa &middot; Hub</span>
          </div>
        </td></tr>
        <tr><td style="height:1px;background:#2a2420;"></td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:#F5C518;text-transform:uppercase;">Let's Connect</p>
          <h1 style="margin:0 0 22px;font-size:28px;font-weight:900;letter-spacing:0.03em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1.15;">
            ${esc(senderName)} would love to chat
          </h1>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">Hi ${esc(firstName)},</p>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">${esc(senderName)} from Fire &amp; Fragrance South Africa would love to schedule a <strong style="color:#F0EBE3;">${durationMinutes}-minute call</strong> with you.</p>
          ${messageBlock}
          <p style="margin:0 0 22px;font-size:15px;color:#B8A898;line-height:1.65;">Click below to pick a few times that work — we'll confirm one back to you. This link expires on <strong style="color:#F0EBE3;">${esc(expiresFormatted)}</strong>.</p>
          <table cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
            <tr><td align="center" style="background:#F5C518;border-radius:8px;">
              <a href="${esc(magicLinkUrl)}" style="display:inline-block;padding:14px 36px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#0D0B09;text-decoration:none;font-family:Arial,sans-serif;">Pick your times</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="height:1px;background:#2a2420;"></td></tr>
        <tr><td align="center" style="padding:24px 40px 28px;">
          <p style="margin:0;font-size:11px;color:#3a3028;font-family:Arial,sans-serif;">Fire &amp; Fragrance South Africa &mdash; ffsahub.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
