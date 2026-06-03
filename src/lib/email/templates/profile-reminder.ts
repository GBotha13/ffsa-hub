import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

export function profileReminderEmailHtml({
  firstName,
  missingLabels,
  signInUrl,
  siteUrl,
}: {
  firstName?: string;
  missingLabels: string[];
  signInUrl: string;
  siteUrl?: string | null;
}): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  const missingList = missingLabels.length
    ? `<ul style="margin:8px 0 16px 24px;padding:0;color:#B8A898;font-size:14px;line-height:1.7;">
        ${missingLabels.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
      </ul>`
    : "";

  return renderEmailShell({
    title: "Finish setting up your FFSA Hub profile",
    preheader: "A few details still needed to unlock your account.",
    eyebrow: "Profile Incomplete",
    heading: "Finish your<br/>profile",
    bodyHtml: `
      ${bodyParagraph(greeting)}
      ${bodyParagraph(`We noticed your ${emphasis("FFSA Hub")} profile is missing a few details. Once those are filled in you'll have full access to the hub.`)}
      ${missingLabels.length ? `<p style="margin:16px 0 4px;font-size:14px;color:#F0EBE3;">Still needed:</p>${missingList}` : ""}
      ${bodyParagraph("Click below to sign in and complete your profile — it should only take a minute.")}
    `,
    cta: { label: "Complete My Profile", url: signInUrl },
    siteUrl,
  });
}
