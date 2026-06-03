import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function referenceRequestEmailHtml({
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
    title: "Reference Request",
    preheader: `${applicantName} has listed you as a reference.`,
    eyebrow: "Reference Request",
    heading: `Hi ${escapeHtml(refereeName)}`,
    bodyHtml: `
      ${bodyParagraph(`${emphasis(escapeHtml(applicantName))} has listed you as a ${emphasis(escapeHtml(slotLabel))} for their application to ${emphasis(escapeHtml(programName))}.`)}
      ${bodyParagraph("Please take a few minutes to submit your reference by clicking the button below.")}
      <p style="margin:24px 0 0;font-size:13px;color:#5a4e42;line-height:1.5;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${escapeHtml(referenceUrl)}" style="color:#F5C518;word-break:break-all;">${escapeHtml(referenceUrl)}</a>
      </p>
    `,
    cta: { label: "Submit Reference", url: referenceUrl },
    siteUrl,
  });
}
