/**
 * Slack message templates per notification event type.
 *
 * Each template returns three fields:
 *   • title  — used as the row title in the dashboard AND the
 *              fallback `text` for Slack notifications
 *   • body   — short description, used in dashboard subtitle
 *   • blocks — Slack Block Kit payload for rich rendering
 *
 * Why a single function rather than a map: payload shapes vary
 * per event_type, and a switch lets each case pluck the fields
 * it needs without elaborate typing.
 */

type Payload = Record<string, unknown> | null;

export type FormatArgs = {
  eventType: string;
  contactName: string | null;
  payload: Payload;
  appUrl: string;
};

export type FormatResult = {
  title: string;
  body: string;
  blocks: unknown[];
};

/**
 * Build the dashboard + Slack representation of a notification.
 * Defensive against missing payload fields — we render "—" rather
 * than crashing if upstream code didn't include an expected field.
 */
export function formatNotification(args: FormatArgs): FormatResult {
  const { eventType, contactName, payload, appUrl } = args;
  const who = contactName ?? "an unidentified contact";

  switch (eventType) {
    // ──── Tier 1 — Action required ───────────────────────────
    case "form_submitted": {
      const formSlug = readString(payload, "form_slug") ?? readString(payload, "form_id");
      const title = `New form submission: ${who}`;
      const body = formSlug ? `Form: ${formSlug}` : "Form submitted via public page.";
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":envelope_with_arrow: *New form submission*",
          lines: [
            `*From:* ${who}`,
            formSlug ? `*Form:* \`${formSlug}\`` : null,
          ],
          appUrl,
        }),
      };
    }

    case "email_bounced": {
      const reason = readString(payload, "bounce_reason") ?? "hard bounce";
      const title = `Hard bounce: ${who}`;
      const body = `Reason: ${reason}. Review and decide whether to retry or remove.`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":warning: *Email hard-bounced*",
          lines: [
            `*Contact:* ${who}`,
            `*Reason:* ${reason}`,
            "Decide whether to retry or remove the address.",
          ],
          appUrl,
        }),
      };
    }

    case "email_complained": {
      const title = `Spam complaint: ${who}`;
      const body = "Contact marked our email as spam. Immediate suppress recommended.";
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":rotating_light: *Spam complaint*",
          lines: [
            `*Contact:* ${who}`,
            "They marked our email as spam — they've been auto-suppressed. Review for follow-up.",
          ],
          appUrl,
        }),
      };
    }

    case "ticket_purchased": {
      const eventTitle = readString(payload, "event_title") ?? "an event";
      const qty = readNumber(payload, "ticket_count");
      const title = `Ticket purchased: ${who}`;
      const body = qty ? `${qty}× tickets to ${eventTitle}` : `Tickets to ${eventTitle}`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":tada: *Ticket purchased*",
          lines: [
            `*Buyer:* ${who}`,
            `*Event:* ${eventTitle}`,
            qty ? `*Tickets:* ${qty}` : null,
          ],
          appUrl,
        }),
      };
    }

    case "assignment_changed": {
      const studentName = readString(payload, "student_name") ?? "a student";
      const programName = readString(payload, "program_name") ?? "a program";
      const resourceType = readString(payload, "resource_type") ?? "record";
      const title = `You're assigned to ${studentName}`;
      const body = `${programName} — ${resourceType.replace(/_/g, " ")}`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":busts_in_silhouette: *You've been assigned*",
          lines: [
            `*Student:* ${studentName}`,
            `*Program:* ${programName}`,
          ],
          appUrl,
        }),
      };
    }

    // ──── Tier 2 — Activity on my contacts ───────────────────
    case "contact_created": {
      const source = readString(payload, "source") ?? "manual";
      const title = `New contact: ${who}`;
      const body = `Source: ${source}`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":new: *New contact created*",
          lines: [`*Contact:* ${who}`, `*Source:* \`${source}\``],
          appUrl,
        }),
      };
    }

    case "contact_merged": {
      const title = `Contact merged: ${who}`;
      const body = "Two contact records were combined.";
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":twisted_rightwards_arrows: *Contacts merged*",
          lines: [`*Surviving contact:* ${who}`],
          appUrl,
        }),
      };
    }

    case "label_added": {
      const labelName = readString(payload, "label_name") ?? readString(payload, "label_slug") ?? "a label";
      const addedVia = readString(payload, "added_via") ?? "manual";
      const title = `${who} — label added`;
      const body = `Added "${labelName}" via ${addedVia}.`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":label: *Label added*",
          lines: [
            `*Contact:* ${who}`,
            `*Label:* \`${labelName}\``,
            `*Via:* ${addedVia}`,
          ],
          appUrl,
        }),
      };
    }

    case "event_attended": {
      const eventTitle = readString(payload, "event_title") ?? "an event";
      const title = `${who} attended ${eventTitle}`;
      const body = `Event: ${eventTitle}`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":calendar: *Event attended*",
          lines: [`*Contact:* ${who}`, `*Event:* ${eventTitle}`],
          appUrl,
        }),
      };
    }

    case "ticket_refunded": {
      const eventTitle = readString(payload, "event_title") ?? "an event";
      const refundCents = readNumber(payload, "refund_cents");
      const refundLabel = refundCents != null ? formatCents(refundCents) : "refund";
      const title = `Refunded: ${who}`;
      const body = `${refundLabel} for ${eventTitle}`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":money_with_wings: *Ticket refunded*",
          lines: [
            `*Contact:* ${who}`,
            `*Event:* ${eventTitle}`,
            refundCents != null ? `*Amount:* ${refundLabel}` : null,
          ],
          appUrl,
        }),
      };
    }

    case "ticket_checked_in": {
      const eventTitle = readString(payload, "event_title") ?? "an event";
      const title = `${who} checked in`;
      const body = `Door scan: ${eventTitle}`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":white_check_mark: *Checked in at the door*",
          lines: [`*Contact:* ${who}`, `*Event:* ${eventTitle}`],
          appUrl,
        }),
      };
    }

    case "manual_interaction": {
      const kind = readString(payload, "kind") ?? "interaction";
      const note = readString(payload, "note");
      const title = `${who} — ${kind} logged`;
      const body = note ?? `A ${kind} was recorded on this contact.`;
      return {
        title,
        body,
        blocks: buildBlocks({
          headline: ":memo: *Manual interaction logged*",
          lines: [
            `*Contact:* ${who}`,
            `*Kind:* ${kind}`,
            note ? `> ${truncate(note, 200)}` : null,
          ],
          appUrl,
        }),
      };
    }

    // ──── Fallback ──────────────────────────────────────────
    default: {
      const human = eventType.replace(/_/g, " ");
      return {
        title: `${human}: ${who}`,
        body: human,
        blocks: buildBlocks({
          headline: `*${human}*`,
          lines: [`*Contact:* ${who}`],
          appUrl,
        }),
      };
    }
  }
}

// ────────────────────────────────────────────────────────────
// Block-Kit helpers
// ────────────────────────────────────────────────────────────

function buildBlocks(args: {
  headline: string;
  lines: Array<string | null | undefined>;
  appUrl: string;
}): unknown[] {
  const lines = args.lines.filter((l): l is string => Boolean(l));
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [args.headline, "", ...lines].join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open in dashboard" },
          url: args.appUrl,
          style: "primary",
        },
      ],
    },
  ];
}

// ────────────────────────────────────────────────────────────
// Defensive payload readers
// ────────────────────────────────────────────────────────────

function readString(payload: Payload, key: string): string | null {
  if (!payload) return null;
  const v = payload[key];
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function readNumber(payload: Payload, key: string): number | null {
  if (!payload) return null;
  const v = payload[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatCents(cents: number): string {
  // Money in the new tables is cents (ZAR per CRM spec). Render
  // as R-prefixed major units. Falls back gracefully if cents is
  // weird.
  const major = (cents / 100).toFixed(2);
  return `R${major}`;
}
