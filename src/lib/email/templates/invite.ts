export function inviteEmailHtml({
  firstName,
  inviteUrl,
}: {
  firstName?: string;
  inviteUrl: string;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're invited to FFSA Hub</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0B09;font-family:'Roboto',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0B09;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#141210;border:1px solid #2a2420;border-radius:14px;overflow:hidden;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,transparent,#F5C518,transparent);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 32px;">
              <!-- Logo text fallback (swap with <img> if hosting logo) -->
              <div style="font-size:28px;font-weight:900;letter-spacing:0.06em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1;">
                FIRE &amp; FRAGRANCE
              </div>
              <div style="margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;">
                <span style="display:inline-block;width:20px;height:1px;background:#F5C518;vertical-align:middle;"></span>
                <span style="font-size:9px;letter-spacing:0.3em;font-weight:700;color:#F5C518;text-transform:uppercase;">HUB</span>
                <span style="display:inline-block;width:20px;height:1px;background:#F5C518;vertical-align:middle;"></span>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="height:1px;background:#2a2420;margin:0 40px;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:#F5C518;text-transform:uppercase;">
                You&rsquo;re invited
              </p>

              <h1 style="margin:0 0 20px;font-size:28px;font-weight:900;letter-spacing:0.03em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1.15;">
                Welcome to<br/>FFSA Hub
              </h1>

              <p style="margin:0 0 12px;font-size:15px;color:#B8A898;line-height:1.65;">
                ${greeting}
              </p>

              <p style="margin:0 0 12px;font-size:15px;color:#B8A898;line-height:1.65;">
                You've been invited to join the <strong style="color:#F0EBE3;">Fire &amp; Fragrance South Africa</strong> internal hub — the central place for your community, events, and mission operations.
              </p>

              <p style="margin:0 0 32px;font-size:15px;color:#B8A898;line-height:1.65;">
                Click the button below to set up your account and get access.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center" style="background:#F5C518;border-radius:8px;box-shadow:0 4px 18px rgba(245,197,24,0.25);">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 36px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#0D0B09;text-decoration:none;font-family:Arial,sans-serif;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:12px;color:#5a4e44;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:11px;color:#7a6e64;word-break:break-all;line-height:1.6;">
                <a href="${inviteUrl}" style="color:#F5C518;text-decoration:none;">${inviteUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="height:1px;background:#2a2420;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;" align="center">
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.25em;color:#3a3028;text-transform:uppercase;font-weight:700;">
                CATALYSE A GENERATION · EVANGELISE THE WORLD
              </p>
              <p style="margin:0;font-size:11px;color:#3a3028;">
                Fire &amp; Fragrance South Africa &mdash; ffsahub.com
              </p>
            </td>
          </tr>

          <!-- Bottom accent bar -->
          <tr>
            <td style="height:2px;background:linear-gradient(90deg,transparent,#2a2420,transparent);"></td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
