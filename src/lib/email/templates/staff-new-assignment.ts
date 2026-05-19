// Sent to a staff member when they are assigned a new applicant or enrolled student.
export function staffNewAssignmentEmailHtml({
  staffFirstName,
  studentName,
  programName,
  stage,
  assignedByName,
  siteUrl,
}: {
  staffFirstName: string;
  studentName: string;
  programName: string;
  stage: "application" | "enrollment";
  assignedByName: string | null;
  siteUrl: string;
}): string {
  const dashboardUrl = `${siteUrl}/dashboard`;
  const eyebrow = stage === "application" ? "New Applicant Assigned" : "New Student Assigned";
  const stageNoun = stage === "application" ? "applicant" : "enrolled student";
  const assignedByLine = assignedByName
    ? `<p style="margin:12px 0 0;font-size:13px;color:#7a6e64;line-height:1.6;">Assigned by ${assignedByName}.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${eyebrow}</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0B09;font-family:'Roboto',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0B09;padding:48px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#141210;border:1px solid #2a2420;border-radius:14px;overflow:hidden;">

          <tr>
            <td style="height:3px;background:linear-gradient(90deg,transparent,#F5C518,transparent);"></td>
          </tr>

          <tr>
            <td align="center" style="padding:40px 40px 32px;">
              <div style="font-size:28px;font-weight:900;letter-spacing:0.06em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1;">
                FIRE &amp; FRAGRANCE
              </div>
              <div style="margin-top:8px;">
                <span style="font-size:9px;letter-spacing:0.3em;font-weight:700;color:#F5C518;text-transform:uppercase;">HUB</span>
              </div>
            </td>
          </tr>

          <tr><td style="height:1px;background:#2a2420;"></td></tr>

          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:#F5C518;text-transform:uppercase;">
                ${eyebrow}
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:900;letter-spacing:0.03em;color:#F0EBE3;font-family:Arial Black,Arial,sans-serif;line-height:1.15;">
                You have a new ${stageNoun}
              </h1>
              <p style="margin:0 0 12px;font-size:15px;color:#B8A898;line-height:1.65;">
                Hi ${staffFirstName}, <strong style="color:#F0EBE3;">${studentName}</strong> has been assigned to you in <strong style="color:#F0EBE3;">${programName}</strong>. They'll see you listed as their point of contact.
              </p>
              ${assignedByLine}

              <table cellpadding="0" cellspacing="0" style="margin-top:28px;margin-bottom:8px;">
                <tr>
                  <td align="center" style="background:#F5C518;border-radius:8px;">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;padding:14px 36px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#0D0B09;text-decoration:none;font-family:Arial,sans-serif;">
                      Open Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:1px;background:#2a2420;"></td></tr>

          <tr>
            <td style="padding:24px 40px;" align="center">
              <p style="margin:0;font-size:11px;color:#3a3028;">
                Fire &amp; Fragrance South Africa &mdash; ffsahub.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
