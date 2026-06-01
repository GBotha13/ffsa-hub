import {
  ffEmailShell,
  ffEsc,
  ffEyebrow,
  ffHeading,
  ffParagraph,
  ffList,
  ffButton,
} from "../ff-email-shell";

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
  const content =
    ffEyebrow("Availability received") +
    ffHeading(`${recipientName} submitted times`) +
    ffParagraph(`Hi ${ffEsc(staffFirstName)},`) +
    ffParagraph(
      `${ffEsc(recipientName)} submitted <strong>${slotCount} time${slotCount === 1 ? "" : "s"}</strong> for your call.`
    ) +
    ffList(firstSlotsPreview.slice(0, 5)) +
    ffParagraph(
      `Open the follow-up queue to pick the time that works best — we&rsquo;ll send the confirmation and calendar invite automatically.`
    ) +
    ffButton(followupUrl, "Pick a time");

  return ffEmailShell({
    previewText: `${recipientName} submitted ${slotCount} time${slotCount === 1 ? "" : "s"}`,
    content,
  });
}
