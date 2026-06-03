import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

// Sent to a student/applicant when a staff member is assigned as their
// point of contact. Used for both the application stage and the enrolled
// stage — the wording adapts to the stage.
export function staffAssignedStudentEmailHtml({
  firstName,
  programName,
  staffName,
  staffEmail,
  stage,
  siteUrl,
}: {
  firstName: string;
  programName: string;
  staffName: string;
  staffEmail: string | null;
  stage: "application" | "enrollment";
  siteUrl: string;
}): string {
  const portalUrl = `${siteUrl}/my-schools`;
  const eyebrow = stage === "application" ? "Your Application Contact" : "Your Program Contact";
  const intro =
    stage === "application"
      ? `Hi ${escapeHtml(firstName)}, ${emphasis(escapeHtml(staffName))} will be your point of contact for your application to ${emphasis(escapeHtml(programName))}. Any questions about your application — they're the person to talk to.`
      : `Hi ${escapeHtml(firstName)}, ${emphasis(escapeHtml(staffName))} will be your point of contact for ${emphasis(escapeHtml(programName))} going forward. They'll be the one checking in with you and answering any questions you have.`;

  const contactBlock = staffEmail
    ? `<p style="margin:0 0 14px;font-size:13px;color:#B8A898;line-height:1.65;">You can reach ${escapeHtml(staffName)} at <a href="mailto:${escapeHtml(staffEmail)}" style="color:#F5C518;text-decoration:none;">${escapeHtml(staffEmail)}</a>.</p>`
    : "";

  return renderEmailShell({
    title: eyebrow,
    preheader: `${staffName} is your contact for ${programName}.`,
    eyebrow,
    heading: "Meet your contact",
    bodyHtml: `
      ${bodyParagraph(intro)}
      ${contactBlock}
    `,
    cta: { label: "Open My Schools", url: portalUrl },
    siteUrl,
  });
}
