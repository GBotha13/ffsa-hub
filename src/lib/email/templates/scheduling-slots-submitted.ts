import { renderEmailShell, escapeHtml, bodyParagraph, emphasis, EMAIL_COLORS } from "../shell";

export function schedulingSlotsSubmittedEmailHtml({
  staffFirstName,
  recipientName,
  slotCount,
  firstSlotsPreview,
  followupUrl,
  siteUrl,
}: {
  staffFirstName: string;
  recipientName: string;
  slotCount: number;
  /** Pre-formatted human strings, e.g. ["Mon 5 Jun, 10:00 SAST", ...]. */
  firstSlotsPreview: string[];
  followupUrl: string;
  siteUrl?: string | null;
}): string {
  const C = EMAIL_COLORS;
  const preview = firstSlotsPreview
    .slice(0, 5)
    .map(
      (s) =>
        `<li style="margin:0 0 6px;font-size:14px;color:${C.TEXT};line-height:1.5;">${escapeHtml(s)}</li>`
    )
    .join("");

  return renderEmailShell({
    title: "Times submitted",
    preheader: `${recipientName} submitted ${slotCount} time${slotCount === 1 ? "" : "s"}.`,
    eyebrow: "Availability Received",
    heading: `${escapeHtml(recipientName)} submitted times`,
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(staffFirstName)},`)}
      ${bodyParagraph(`${escapeHtml(recipientName)} submitted ${emphasis(`${slotCount} time${slotCount === 1 ? "" : "s"}`)} for your call.`)}
      <ul style="margin:0 0 20px;padding:0 0 0 20px;color:${C.TEXT_DIM};">${preview}</ul>
      ${bodyParagraph("Open the follow-up queue to pick the time that works best — we'll send the confirmation and calendar invite automatically.")}
    `,
    cta: { label: "Pick a time", url: followupUrl },
    siteUrl,
  });
}
