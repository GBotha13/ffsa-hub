import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function inviteEmailHtml({
  firstName,
  inviteUrl,
  siteUrl,
}: {
  firstName?: string;
  inviteUrl: string;
  siteUrl?: string | null;
}): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

  return renderEmailShell({
    title: "You're invited to FFSA Hub",
    preheader: "You've been invited to join Fire & Fragrance South Africa's internal hub.",
    eyebrow: "You're Invited",
    heading: "Welcome to<br/>FFSA Hub",
    bodyHtml: `
      ${bodyParagraph(greeting)}
      ${bodyParagraph(`You've been invited to join the ${emphasis("Fire & Fragrance South Africa")} internal hub — the central place for your community, events, and mission operations.`)}
      ${bodyParagraph("Click the button below to set up your account and get access.")}
      <p style="margin:24px 0 4px;font-size:12px;color:#5a4e44;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-size:11px;color:#7a6e64;word-break:break-all;line-height:1.6;">
        <a href="${escapeHtml(inviteUrl)}" style="color:#F5C518;text-decoration:none;">${escapeHtml(inviteUrl)}</a>
      </p>
    `,
    cta: { label: "Accept Invitation", url: inviteUrl },
    siteUrl,
  });
}
