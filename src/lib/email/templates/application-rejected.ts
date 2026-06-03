import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function applicationRejectedEmailHtml({
  firstName,
  programName,
  siteUrl,
}: {
  firstName: string;
  programName: string;
  siteUrl?: string | null;
}): string {
  return renderEmailShell({
    title: "Application Update",
    preheader: `An update on your ${programName} application.`,
    eyebrow: "Application Update",
    heading: "Application Decision",
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${bodyParagraph(`Thank you for your interest in ${emphasis(escapeHtml(programName))} and for taking the time to apply. We truly appreciate the effort you put into your application.`)}
      ${bodyParagraph("After careful review, we are unfortunately unable to offer you a place in the program at this time. Please know that this was not an easy decision, and it does not diminish the value of your calling or gifts.")}
      ${bodyParagraph("We wish you all the best for the future and encourage you to continue pursuing what God has placed on your heart. We would love to see you apply again in the future.")}
    `,
    siteUrl,
  });
}
