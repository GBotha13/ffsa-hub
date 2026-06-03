import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function applicationAcceptedEmailHtml({
  firstName,
  programName,
  inviteUrl,
  customBodyHtml,
  siteUrl,
}: {
  firstName: string;
  programName: string;
  inviteUrl: string;
  customBodyHtml?: string | null;
  siteUrl?: string | null;
}): string {
  const bodyHtml = customBodyHtml ?? `
      ${bodyParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${bodyParagraph(`We're excited to let you know that your application to ${emphasis(escapeHtml(programName))} has been accepted!`)}
      ${bodyParagraph("Click the button below to set up your account on FFSA Hub and get started.")}
    `;

  return renderEmailShell({
    title: "You've Been Accepted",
    preheader: `Your ${programName} application has been accepted.`,
    eyebrow: "Congratulations",
    heading: "You&rsquo;ve Been<br/>Accepted!",
    bodyHtml: `
      ${bodyHtml}
      <p style="margin:24px 0 4px;font-size:12px;color:#5a4e44;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-size:11px;color:#7a6e64;word-break:break-all;line-height:1.6;">
        <a href="${escapeHtml(inviteUrl)}" style="color:#F5C518;text-decoration:none;">${escapeHtml(inviteUrl)}</a>
      </p>
    `,
    cta: { label: "Set Up Your Account", url: inviteUrl },
    siteUrl,
  });
}
