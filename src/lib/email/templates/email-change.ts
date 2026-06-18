import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function emailChangeConfirmHtml({
  firstName,
  confirmUrl,
  newEmail,
  siteUrl,
}: {
  firstName?: string;
  confirmUrl: string;
  newEmail: string;
  siteUrl?: string | null;
}): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

  return renderEmailShell({
    title: "Confirm your new FFSA Hub email",
    preheader: "Confirm the new email address for your FFSA Hub account.",
    eyebrow: "Email Change",
    heading: "Confirm your<br/>new email",
    bodyHtml: `
      ${bodyParagraph(greeting)}
      ${bodyParagraph(`We received a request to change the sign-in email on your ${emphasis("FFSA Hub")} account to ${emphasis(escapeHtml(newEmail))}. Click the button below to confirm it's really you.`)}
      ${bodyParagraph("Your sign-in email won't change until you confirm. This link expires in 1 hour.")}
      <p style="margin:24px 0 4px;font-size:12px;color:#5a4e44;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-size:11px;color:#7a6e64;word-break:break-all;line-height:1.6;">
        <a href="${escapeHtml(confirmUrl)}" style="color:#F5C518;text-decoration:none;">${escapeHtml(confirmUrl)}</a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#5a4e44;line-height:1.6;">If you didn't request this, you can safely ignore this email — nothing will change.</p>
    `,
    cta: { label: "Confirm New Email", url: confirmUrl },
    siteUrl,
  });
}
