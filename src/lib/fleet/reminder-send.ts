// The 07:00 Fleet reminder (SPEC 6.11): build it with the tested rules, then send it to
// whoever holds the Vehicle Coordinator role, by email and by Slack DM from the Hub's
// Slack app. Replaces the claude.ai scheduled task "FFSA vehicle inspection reminders".
//
// Sending is OFF everywhere except the live site (VERCEL_ENV=production and preview
// writes not disabled), so local runs, Vercel previews (which share the production
// database) and tests can never message anyone. Everywhere else this only builds the
// message, which is what the admin preview page shows.

import { previewWritesDisabled } from "@/lib/preview-writes";
import { bodyParagraph, emphasis, escapeHtml, renderEmailShell } from "@/lib/email/shell";
import { sendTransactional } from "@/lib/email/send-transactional";
import * as slack from "@/lib/slack/client";
import { isBotConfigured } from "@/lib/slack/bots";
import { loadFleet, type Coordinator } from "./load";
import { REMINDER_SECTIONS, buildReminder, todayInSA, type ISODate, type Reminder } from "./rules";

type Client = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** True only on the live site. Everything else builds the message without sending it. */
export function canSendFleetReminder(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.FLEET_REMINDER_DISABLED === "1" || env.FLEET_REMINDER_DISABLED === "true") return false;
  return env.VERCEL_ENV === "production" && !previewWritesDisabled(env);
}

/** Fleet → Today on the Hub. */
export function fleetTodayUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base = (env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || "https://www.ffsahub.com").replace(/\/+$/, "");
  return `${base}/bookings/vehicles/fleet`;
}

// ── The message in each channel ────────────────────────────

export function reminderEmailHtml(r: Reminder, url: string): string {
  const sections = REMINDER_SECTIONS.filter(([k]) => r.sections[k].length)
    .map(
      ([k, title]) =>
        bodyParagraph(emphasis(escapeHtml(title))) +
        `<ul style="margin:0 0 16px 18px;padding:0">${r.sections[k].map((l) => `<li style="margin:0 0 6px 0">${escapeHtml(l)}</li>`).join("")}</ul>`
    )
    .join("");
  return renderEmailShell({
    title: r.subject,
    preheader: r.subject,
    eyebrow: "FFSA Fleet",
    heading: "Today’s vehicle checks",
    bodyHtml: sections,
    cta: { label: "Open Fleet", url },
    siteUrl: url.replace(/\/bookings\/vehicles\/fleet$/, ""),
  });
}

/** Slack mrkdwn: bold subject, then each section as a bulleted list, then the link. */
export function reminderSlackText(r: Reminder, url: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = REMINDER_SECTIONS.filter(([k]) => r.sections[k].length)
    .map(([k, title]) => `*${title}*\n${r.sections[k].map((l) => "• " + esc(l)).join("\n")}`)
    .join("\n\n");
  return `*${esc(r.subject)}*\n\n${body}\n\n<${url}|Open Fleet>`;
}

// ── Sending ────────────────────────────────────────────────

export type ChannelResult = "ok" | "off" | "missing" | "error";
export interface RecipientResult {
  name: string;
  email: ChannelResult;
  slack: ChannelResult;
  errors?: string[];
}

export interface ReminderDeps {
  sendEmail: (to: string, subject: string, html: string, text: string) => Promise<{ ok: boolean; error?: string }>;
  sendSlackDm: (slackUserId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
  slackReady: () => boolean;
}

export const realDeps: ReminderDeps = {
  async sendEmail(to, subject, html, text) {
    const r = await sendTransactional({
      to,
      subject,
      html,
      text,
      category: "fleet_reminder",
      fromName: "FFSA Fleet",
      reason: "You hold the Vehicle Coordinator role: this is Fleet's daily 07:00 reminder.",
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
  async sendSlackDm(slackUserId, text) {
    const conv = await slack.openConversation(slackUserId, "hub");
    const channel = conv.ok ? (conv as { channel?: { id: string } }).channel?.id : undefined;
    if (!channel) return { ok: false, error: (conv as { error?: string }).error || "no DM channel" };
    const sent = await slack.postMessage({ channel, text, bot: "hub" });
    return sent.ok ? { ok: true } : { ok: false, error: (sent as { error?: string }).error || "post failed" };
  },
  slackReady: () => isBotConfigured("hub"),
};

/** Deliver one reminder to each co-ordinator by the channels switched on in settings. */
export async function deliverReminder(
  r: Reminder,
  url: string,
  coordinators: Coordinator[],
  notify: { email?: unknown; slack?: unknown },
  deps: ReminderDeps
): Promise<RecipientResult[]> {
  const emailOn = notify.email !== false;
  const slackOn = notify.slack !== false;
  const html = reminderEmailHtml(r, url);
  const slackText = reminderSlackText(r, url);
  const out: RecipientResult[] = [];
  for (const c of coordinators) {
    const res: RecipientResult = { name: c.name, email: "off", slack: "off" };
    const errors: string[] = [];
    if (emailOn) {
      if (!c.email) res.email = "missing";
      else {
        const e = await deps.sendEmail(c.email, r.subject, html, r.text).catch((err) => ({ ok: false, error: String(err?.message || err) }));
        res.email = e.ok ? "ok" : "error";
        if (!e.ok && e.error) errors.push("email: " + e.error);
      }
    }
    if (slackOn) {
      if (!c.slackUserId || !deps.slackReady()) res.slack = "missing";
      else {
        const s = await deps.sendSlackDm(c.slackUserId, slackText).catch((err) => ({ ok: false, error: String(err?.message || err) }));
        res.slack = s.ok ? "ok" : "error";
        if (!s.ok && s.error) errors.push("slack: " + s.error);
      }
    }
    if (errors.length) res.errors = errors;
    out.push(res);
  }
  return out;
}

export interface ReminderRun {
  date: ISODate;
  reminder: Reminder;
  url: string;
  coordinators: Coordinator[];
  notify: { email: boolean; slack: boolean };
  /** What happened: preview only, nothing to say, already sent today, no one to send to, or sent. */
  outcome: "preview" | "empty" | "already-sent" | "no-coordinator" | "sent";
  results?: RecipientResult[];
}

/**
 * Build the reminder for `date` (default: today in South Africa) and, when `send` is
 * true and there's something to say, deliver it once. `admin` is the service-role client.
 */
export async function runFleetReminder(
  admin: Client,
  opts: { date?: ISODate; send: boolean; deps?: ReminderDeps; url?: string }
): Promise<ReminderRun> {
  const date = opts.date || todayInSA();
  const url = opts.url || fleetTodayUrl();
  const { F, coordinators } = await loadFleet(admin, date);
  const reminder = buildReminder(F, date, { appUrl: url, linkText: "Open Fleet" });
  const n = (F.notify || {}) as { email?: unknown; slack?: unknown };
  const notify = { email: n.email !== false, slack: n.slack !== false };
  const base = { date, reminder, url, coordinators, notify };

  if (reminder.empty) return { ...base, outcome: "empty" };
  if (!opts.send) return { ...base, outcome: "preview" };
  if (!coordinators.length) return { ...base, outcome: "no-coordinator" };

  // Claim the day first, so a retried or doubled cron can't send twice.
  const claim = await admin.from("fleet_reminder_sends").insert({ date, subject: reminder.subject, recipients: [] });
  if (claim.error) {
    if (claim.error.code === "23505") return { ...base, outcome: "already-sent" };
    throw new Error(claim.error.message);
  }
  const results = await deliverReminder(reminder, url, coordinators, n, opts.deps || realDeps);
  await admin.from("fleet_reminder_sends").update({ recipients: results }).eq("date", date);
  return { ...base, outcome: "sent", results };
}
