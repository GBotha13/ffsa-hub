import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function referenceReminderEmailHtml({
  refereeName,
  applicantName,
  programName,
  slotLabel,
  referenceUrl,
  siteUrl,
}: {
  refereeName: string;
  applicantName: string;
  programName: string;
  slotLabel: string;
  referenceUrl: string;
  siteUrl?: string | null;
}): string {
  return renderEmailShell({
    title: "Reference Reminder",
    preheader: `Reminder: ${applicantName}'s reference still needs your input.`,
    eyebrow: "Friendly Reminder",
    heading: `Hi ${escapeHtml(refereeName)}`,
    bodyHtml: `
      ${bodyParagraph(`Just a friendly reminder that ${emphasis(escapeHtml(applicantName))} listed you as a ${emphasis(escapeHtml(slotLabel))} for their application to ${emphasis(escapeHtml(programName))}, and we haven&rsquo;t received your reference yet.`)}
      ${bodyParagraph("We would really appreciate it if you could take a few minutes to submit your reference when you get a chance. It makes a big difference in helping us process their application.")}
      <p style="margin:24px 0 0;font-size:13px;color:#5a4e42;line-height:1.5;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${escapeHtml(referenceUrl)}" style="color:#F5C518;word-break:break-all;">${escapeHtml(referenceUrl)}</a>
      </p>
    `,
    cta: { label: "Submit Reference", url: referenceUrl },
    siteUrl,
  });
}
