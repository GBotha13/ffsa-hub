import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function resetPasswordEmailHtml({
  firstName,
  resetUrl,
  siteUrl,
}: {
  firstName?: string;
  resetUrl: string;
  siteUrl?: string | null;
}): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

  return renderEmailShell({
    title: "Reset your FFSA Hub password",
    preheader: "Use the link inside to set a new password for your FFSA Hub account.",
    eyebrow: "Password Reset",
    heading: "Reset your<br/>password",
    bodyHtml: `
      ${bodyParagraph(greeting)}
      ${bodyParagraph(`We received a request to reset the password for your ${emphasis("FFSA Hub")} account. Click the button below to choose a new one.`)}
      ${bodyParagraph("For your security, this link expires in 1 hour and can only be used once.")}
      <p style="margin:24px 0 4px;font-size:12px;color:#5a4e44;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-size:11px;color:#7a6e64;word-break:break-all;line-height:1.6;">
        <a href="${escapeHtml(resetUrl)}" style="color:#F5C518;text-decoration:none;">${escapeHtml(resetUrl)}</a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#5a4e44;line-height:1.6;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
    cta: { label: "Reset Password", url: resetUrl },
    siteUrl,
  });
}
