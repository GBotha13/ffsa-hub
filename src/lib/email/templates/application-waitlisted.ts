export function applicationWaitlistedEmailHtml({
  firstName,
  programName,
}: {
  firstName: string;
  programName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Application Update</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0B09;font-family:'Roboto',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0B09;padding:48px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#141210;border:1px solid #2a2420;border-radius:14px;overflow:hidden;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,transparent,#F5C518,transparent);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 32px;">
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

          <tr>
            <td style="height:1px;background:#2a2420;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:#F5C518;text-transform:uppercase;">
                Application Update
              </p>

              <h1 style="margin:0 0 20px;font-size:28px;font-weight:900;letter-spacing:0.03em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1.15;">
                You&rsquo;re on the Waitlist
              </h1>

              <p style="margin:0 0 12px;font-size:15px;color:#B8A898;line-height:1.65;">
                Hi ${firstName},
              </p>

              <p style="margin:0 0 12px;font-size:15px;color:#B8A898;line-height:1.65;">
                Thank you for applying to <strong style="color:#F0EBE3;">${programName}</strong>. Your application was strong, and we were impressed by what you shared.
              </p>

              <p style="margin:0 0 12px;font-size:15px;color:#B8A898;line-height:1.65;">
                At this stage, we have placed you on our waitlist. This means that if a spot opens up, we will reach out to you as soon as possible.
              </p>

              <p style="margin:0 0 0;font-size:15px;color:#B8A898;line-height:1.65;">
                We appreciate your patience and will keep you updated on any changes. In the meantime, feel free to reach out if you have any questions.
              </p>

            </td>
          </tr>

          <tr>
            <td style="height:1px;background:#2a2420;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;" align="center">
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.25em;color:#3a3028;text-transform:uppercase;font-weight:700;">
                CATALYSE A GENERATION &middot; EVANGELISE THE WORLD
              </p>
              <p style="margin:0;font-size:11px;color:#3a3028;">
                Fire &amp; Fragrance South Africa &mdash; ffsahub.com
              </p>
            </td>
          </tr>

          <tr>
            <td style="height:2px;background:linear-gradient(90deg,transparent,#2a2420,transparent);"></td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
