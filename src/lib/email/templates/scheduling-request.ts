import {
  ffEmailShell,
  ffEsc,
  ffEyebrow,
  ffHeading,
  ffParagraph,
  ffQuote,
  ffButton,
} from "../ff-email-shell";

export function schedulingRequestEmailHtml({
  firstName,
  senderName,
  durationMinutes,
  expiresAt,
  message,
  magicLinkUrl,
}: {
  firstName: string;
  senderName: string;
  durationMinutes: number;
  expiresAt: string;
  message?: string | null;
  magicLinkUrl: string;
}): string {
  const expiresFormatted = new Date(expiresAt).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const content =
    ffEyebrow("Let's connect") +
    ffHeading(`${senderName} would love to chat`) +
    ffParagraph(`Hi ${ffEsc(firstName)},`) +
    ffParagraph(
      `${ffEsc(senderName)} from Fire &amp; Fragrance South Africa would love to schedule a <strong>${durationMinutes}-minute call</strong> with you.`
    ) +
    (message ? ffQuote(message) : "") +
    ffParagraph(
      `Pick a few times that work and we&rsquo;ll confirm one back to you. This link expires on <strong>${ffEsc(expiresFormatted)}</strong>.`
    ) +
    ffButton(magicLinkUrl, "Pick your times");

  return ffEmailShell({
    previewText: `${senderName} would love to schedule a ${durationMinutes}-minute call`,
    content,
  });
}
