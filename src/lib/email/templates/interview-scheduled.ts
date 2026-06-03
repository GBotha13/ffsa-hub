import { renderEmailShell, escapeHtml, bodyParagraph, emphasis, EMAIL_COLORS } from "../shell";

export function interviewScheduledEmailHtml({
  firstName,
  programName,
  interviewDate,
  interviewNotes,
  siteUrl,
}: {
  firstName: string;
  programName: string;
  interviewDate?: string;
  interviewNotes?: string;
  siteUrl?: string | null;
}): string {
  const C = EMAIL_COLORS;
  const dateLine = interviewDate
    ? bodyParagraph(`Your interview is scheduled for ${emphasis(escapeHtml(interviewDate))}.`)
    : "";

  const notesLine = interviewNotes
    ? `<p style="margin:0 0 14px;font-size:15px;color:${C.TEXT_DIM};line-height:1.65;">${emphasis("Additional Details:")}<br/>${escapeHtml(interviewNotes)}</p>`
    : "";

  return renderEmailShell({
    title: "Interview Scheduled",
    preheader: `Your ${programName} interview details.`,
    eyebrow: "Next Steps",
    heading: "Interview Scheduled",
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${bodyParagraph(`Congratulations on progressing to the interview stage of your application to ${emphasis(escapeHtml(programName))}! We enjoyed reading your application and would love to get to know you better.`)}
      ${dateLine}
      ${notesLine}
      ${bodyParagraph("If you have any questions or need to reschedule, please don&rsquo;t hesitate to reach out. We look forward to speaking with you!")}
    `,
    siteUrl,
  });
}
