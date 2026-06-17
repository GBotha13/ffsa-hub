import { renderEmailShell, escapeHtml, bodyParagraph, emphasis } from "../shell";

// Sent to a set owner when an invited person accepts their roster invitation.
export function prayerRoomInviteAcceptedEmailHtml({
  ownerFirstName,
  accepterName,
  roleLabel,
  setWhen,
  setTitle,
  siteUrl,
}: {
  ownerFirstName: string;
  accepterName: string;
  roleLabel: string;
  setWhen: string;
  setTitle: string;
  siteUrl: string;
}): string {
  return renderEmailShell({
    title: "Invite accepted",
    preheader: `${accepterName} accepted — ${roleLabel}`,
    eyebrow: "Roster Update",
    heading: "An invite was accepted",
    bodyHtml: `
      ${bodyParagraph(`Hi ${escapeHtml(ownerFirstName)}, ${emphasis(escapeHtml(accepterName))} accepted your invitation to serve as ${emphasis(escapeHtml(roleLabel))}.`)}
      ${bodyParagraph(`${emphasis(escapeHtml(setTitle))}<br/>${escapeHtml(setWhen)}`)}
    `,
    cta: { label: "View the Set", url: `${siteUrl}/prayer-room` },
    siteUrl,
  });
}
