function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function schedulingSlotsSubmittedEmailHtml({
  staffFirstName,
  recipientName,
  slotCount,
  firstSlotsPreview,
  followupUrl,
}: {
  staffFirstName: string;
  recipientName: string;
  slotCount: number;
  firstSlotsPreview: string[];
  followupUrl: string;
}): string {
  const preview = firstSlotsPreview
    .slice(0, 5)
    .map(
      (s) =>
        `<li style="margin:0 0 6px;font-size:14px;color:#F0EBE3;line-height:1.5;">${esc(s)}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Times submitted</title>
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
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:#F5C518;text-transform:uppercase;">Availability Received</p>
          <h1 style="margin:0 0 22px;font-size:26px;font-weight:900;letter-spacing:0.03em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1.15;">
            ${esc(recipientName)} submitted times
          </h1>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">Hi ${esc(staffFirstName)},</p>
          <p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">${esc(recipientName)} submitted <strong style="color:#F0EBE3;">${slotCount} time${slotCount === 1 ? "" : "s"}</strong> for your call.</p>
          <ul style="margin:0 0 20px;padding:0 0 0 20px;color:#B8A898;">${preview}</ul>
          <p style="margin:0 0 22px;font-size:15px;color:#B8A898;line-height:1.65;">Open the follow-up queue to pick the time that works best — we'll send the confirmation and calendar invite automatically.</p>
          <table cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
            <tr><td align="center" style="background:#F5C518;border-radius:8px;">
              <a href="${esc(followupUrl)}" style="display:inline-block;padding:14px 36px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#0D0B09;text-decoration:none;font-family:Arial,sans-serif;">Pick a time</a>
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
