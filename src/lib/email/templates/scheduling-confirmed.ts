import { renderEmailShell, escapeHtml, bodyParagraph, emphasis, EMAIL_COLORS } from "../shell";

export function schedulingConfirmedEmailHtml({
  firstName,
  senderName,
  formattedDateTime,
  durationMinutes,
  message,
  siteUrl,
}: {
  firstName: string;
  senderName: string;
  formattedDateTime: string; // already localized for recipient
  durationMinutes: number;
  message?: string | null;
  siteUrl?: string | null;
}): string {
  const C = EMAIL_COLORS;

  const messageBlock = message
    ? bodyParagraph(`&ldquo;${escapeHtml(message)}&rdquo;`)
    : "";

  return renderEmailShell({
    title: "Call confirmed",
    preheader: `Confirmed for ${formattedDateTime}.`,
    eyebrow: "Confirmed",
    heading: "Your call is set",
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${bodyParagraph(`Your ${emphasis(`${durationMinutes}-minute call`)} with ${escapeHtml(senderName)} is confirmed for:`)}
      <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${C.YELLOW};letter-spacing:0.02em;">${escapeHtml(formattedDateTime)}</p>
      ${bodyParagraph("A calendar invite is attached to this email — just open it to add the call to your calendar.")}
      ${messageBlock}
      ${bodyParagraph("Looking forward to talking with you!")}
    `,
    siteUrl,
  });
}
