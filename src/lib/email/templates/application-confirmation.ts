import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function applicationConfirmationEmailHtml({
  firstName,
  programName,
  statusUrl,
  siteUrl,
}: {
  firstName: string;
  programName: string;
  statusUrl?: string | null;
  siteUrl?: string | null;
}): string {
  return renderEmailShell({
    title: "Application Received",
    preheader: `We've received your ${programName} application.`,
    eyebrow: "Application Received",
    heading: `Thank You,<br/>${escapeHtml(firstName)}`,
    bodyHtml: `
      ${bodyParagraph(`Your application to ${emphasis(escapeHtml(programName))} has been received and is now under review.`)}
      ${bodyParagraph("Our team will review your application and get back to you as soon as possible. You'll receive an email once a decision has been made.")}
      ${bodyParagraph("If you have any questions in the meantime, feel free to reach out to us.")}
      ${statusUrl ? `<p style="margin:18px 0 0;font-size:13px;color:#5a4e42;line-height:1.5;">You can check your application status anytime using the button below.</p>` : ""}
    `,
    cta: statusUrl ? { label: "Track Your Application", url: statusUrl } : undefined,
    siteUrl,
  });
}
