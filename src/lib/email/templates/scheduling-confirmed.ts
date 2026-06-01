function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function schedulingConfirmedEmailHtml({
  firstName,
  senderName,
  formattedDateTime,
  durationMinutes,
  message,
}: {
  firstName: string;
  senderName: string;
  formattedDateTime: string;
  durationMinutes: number;
  message?: string | null;
}): string {
  const messageBlock = message
    ? `<p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;font-style:italic;">&ldquo;${esc(message)}&rdquo;</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Call confirmed</title>
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
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:#F5C518;text-transform:uppercase;">Confirmed</p>
          <h1 style="margin:0 0 22px;font-size:28px;font-weight:900;letter-spacing:0.03em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1.15;">
            Your call is set
          </h1>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">Hi ${esc(firstName)},</p>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">Your <strong style="color:#F0EBE3;">${durationMinutes}-minute call</strong> with ${esc(senderName)} is confirmed for:</p>
          <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#F5C518;letter-spacing:0.02em;">${esc(formattedDateTime)}</p>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">A calendar invite is attached to this email — just open it to add the call to your calendar.</p>
          ${messageBlock}
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">Looking forward to talking with you!</p>
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
