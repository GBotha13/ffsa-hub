import {
  ffEmailShell,
  ffEsc,
  ffEyebrow,
  ffHeading,
  ffParagraph,
  ffStrongLine,
  ffQuote,
} from "../ff-email-shell";

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
  const content =
    ffEyebrow("Confirmed") +
    ffHeading("Your call is set") +
    ffParagraph(`Hi ${ffEsc(firstName)},`) +
    ffParagraph(
      `Your <strong>${durationMinutes}-minute call</strong> with ${ffEsc(senderName)} is confirmed for:`
    ) +
    ffStrongLine(formattedDateTime) +
    ffParagraph(
      `A calendar invite is attached to this email — open it to add the call to your calendar.`
    ) +
    (message ? ffQuote(message) : "") +
    ffParagraph(`Looking forward to talking with you!`);

  return ffEmailShell({
    previewText: `Your call with ${senderName} is confirmed for ${formattedDateTime}`,
    content,
  });
}
