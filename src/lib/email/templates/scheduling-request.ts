import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function schedulingRequestEmailHtml({
  firstName,
  senderName,
  durationMinutes,
  expiresAt,
  message,
  magicLinkUrl,
  siteUrl,
}: {
  firstName: string;
  senderName: string;
  durationMinutes: number;
  expiresAt: string; // ISO
  message?: string | null;
  magicLinkUrl: string;
  siteUrl?: string | null;
}): string {
  const expiresFormatted = new Date(expiresAt).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const messageBlock = message
    ? bodyParagraph(`&ldquo;${escapeHtml(message)}&rdquo;`)
    : "";

  return renderEmailShell({
    title: "Let's connect",
    preheader: `Pick a time that works for a ${durationMinutes}-minute call.`,
    eyebrow: "Let's Connect",
    heading: `${escapeHtml(senderName)} would love to chat`,
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${bodyParagraph(`${escapeHtml(senderName)} from Fire &amp; Fragrance South Africa would love to schedule a ${emphasis(`${durationMinutes}-minute call`)} with you.`)}
      ${messageBlock}
      ${bodyParagraph(`Click below to pick a few times that work — we'll confirm one back to you. This link expires on ${emphasis(expiresFormatted)}.`)}
    `,
    cta: { label: "Pick your times", url: magicLinkUrl },
    siteUrl,
  });
}
