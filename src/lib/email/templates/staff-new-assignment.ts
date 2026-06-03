import { renderEmailShell, escapeHtml, bodyParagraph, emphasis, EMAIL_COLORS } from "../shell";

// Sent to a staff member when they are assigned a new applicant or enrolled student.
export function staffNewAssignmentEmailHtml({
  staffFirstName,
  studentName,
  programName,
  stage,
  assignedByName,
  siteUrl,
}: {
  staffFirstName: string;
  studentName: string;
  programName: string;
  stage: "application" | "enrollment";
  assignedByName: string | null;
  siteUrl: string;
}): string {
  const C = EMAIL_COLORS;
  const dashboardUrl = `${siteUrl}/dashboard`;
  const eyebrow = stage === "application" ? "New Applicant Assigned" : "New Student Assigned";
  const stageNoun = stage === "application" ? "applicant" : "enrolled student";
  const assignedByLine = assignedByName
    ? `<p style="margin:12px 0 0;font-size:13px;color:${C.TEXT_DIMMER};line-height:1.6;">Assigned by ${escapeHtml(assignedByName)}.</p>`
    : "";

  return renderEmailShell({
    title: eyebrow,
    preheader: `${studentName} has been assigned to you.`,
    eyebrow,
    heading: `You have a new ${stageNoun}`,
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(staffFirstName)}, ${emphasis(escapeHtml(studentName))} has been assigned to you in ${emphasis(escapeHtml(programName))}. They'll see you listed as their point of contact.`)}
      ${assignedByLine}
    `,
    cta: { label: "Open Dashboard", url: dashboardUrl },
    siteUrl,
  });
}
