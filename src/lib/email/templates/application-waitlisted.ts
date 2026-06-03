import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function applicationWaitlistedEmailHtml({
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
    preheader: `Your ${programName} application has been placed on the waitlist.`,
    eyebrow: "Application Update",
    heading: "You&rsquo;re on the Waitlist",
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${bodyParagraph(`Thank you for applying to ${emphasis(escapeHtml(programName))}. Your application was strong, and we were impressed by what you shared.`)}
      ${bodyParagraph("At this stage, we have placed you on our waitlist. This means that if a spot opens up, we will reach out to you as soon as possible.")}
      ${bodyParagraph("We appreciate your patience and will keep you updated on any changes. In the meantime, feel free to reach out if you have any questions.")}
    `,
    siteUrl,
  });
}
