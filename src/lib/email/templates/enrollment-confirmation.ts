import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function enrollmentConfirmationEmailHtml({
  firstName,
  programName,
  siteUrl,
  customBodyHtml,
}: {
  firstName: string;
  programName: string;
  siteUrl: string;
  customBodyHtml?: string | null;
}): string {
  const programsUrl = `${siteUrl}/my-schools`;
  const bodyHtml = customBodyHtml ??
    bodyParagraph(`Hi ${escapeHtml(firstName)}, your application to ${emphasis(escapeHtml(programName))} has been accepted. You're enrolled and can access your program right away.`);

  return renderEmailShell({
    title: "You're Enrolled",
    preheader: `You're enrolled in ${programName}.`,
    eyebrow: "You're Enrolled",
    heading: "Welcome Back!",
    bodyHtml: `
      ${bodyHtml}
      <p style="margin:24px 0 4px;font-size:12px;color:#5a4e44;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-size:11px;color:#7a6e64;word-break:break-all;line-height:1.6;">
        <a href="${escapeHtml(programsUrl)}" style="color:#F5C518;text-decoration:none;">${escapeHtml(programsUrl)}</a>
      </p>
    `,
    cta: { label: "View My Programs", url: programsUrl },
    siteUrl,
  });
}
