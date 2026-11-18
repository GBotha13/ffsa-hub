// Legal → Documents — what the 07:00 reminder says, and when. Pure: the
// cron (/api/cron/legal-reminders), the preview and the dashboard card all
// build from here, so they never disagree. Plan: docs/legal-documents.md.
//
// When something is mentioned:
//   * Documents, before expiry: 90, 60, 30 and 7 days ahead and on the day —
//     but only the milestones inside the document's own renewal window
//     (a 30-day lead time is not nagged at 90). 7 days and the day itself
//     always count. Once a renewal is under way only 7 and 0 still count.
//   * Documents, after expiry: every 7 days while still expired.
//   * Applications not yet lodged: 14, 7 and 1 days before lodge-by and on
//     the day; then every 7 days while late.
//   * Applications lodged and past their expected date: every 7 days.
//   * Mondays: everything still open, even with no milestone that day.
// Nothing is sent on a day with nothing to say.

import {
  applicationState,
  daysBetween,
  describeDays,
  documentState,
  isApplicationOpen,
  type DocumentState,
} from "./status";

export const DOCUMENT_MILESTONES = [90, 60, 30, 7, 0];
export const APPLICATION_MILESTONES = [14, 7, 1, 0];

export type ReminderDoc = {
  id: string;
  title: string;
  folder_id: string;
  type_id: string | null;
  expires_on: string | null;
  renew_lead_days: number | null;
  status: string;
  superseded_by: string | null;
};
export type ReminderApp = {
  id: string;
  title: string;
  folder_id: string;
  document_id: string | null;
  status: string;
  lodge_by: string | null;
  submitted_on: string | null;
  expected_on: string | null;
};

export type ReminderLine = {
  kind: "document" | "application";
  id: string;
  title: string;
  folder: string;
  /** Plain words: "30 days left", "Expired 14 days ago", "Lodge by 2 Dec". */
  when: string;
  tone: "bad" | "warn" | "quiet";
  /** Sort key: days until the date that matters (negative = past). */
  days: number;
};

export type Reminder = {
  /** Lines that hit a milestone today. */
  today: ReminderLine[];
  /** Everything else still needing someone (Monday summary, dashboard). */
  open: ReminderLine[];
  counts: { expired: number; renewNow: number; missing: number; applicationsPressing: number };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

function documentMilestone(state: DocumentState, daysLeft: number | null, leadDays: number): boolean {
  if (daysLeft === null) return false;
  if (state === "expired") return -daysLeft % 7 === 0;
  if (state === "expiring") return DOCUMENT_MILESTONES.includes(daysLeft) && (daysLeft <= leadDays || daysLeft <= 7);
  if (state === "in_hand") return daysLeft === 7 || daysLeft === 0;
  // A week's notice for everything, even with a shorter lead time.
  if (state === "valid") return daysLeft === 7;
  return false;
}

export function buildReminder(args: {
  today: string;
  documents: ReminderDoc[];
  applications: ReminderApp[];
  typeLeadDays: Map<string, number>;
  folderNames: Map<string, string>;
}): Reminder {
  const { today, documents, applications, typeLeadDays, folderNames } = args;
  const openFor = new Set(applications.filter((a) => isApplicationOpen(a.status) && a.document_id).map((a) => a.document_id));
  const todayLines: ReminderLine[] = [];
  const open: ReminderLine[] = [];
  const counts = { expired: 0, renewNow: 0, missing: 0, applicationsPressing: 0 };

  for (const d of documents) {
    const s = documentState(
      { ...d, type_lead_days: d.type_id ? typeLeadDays.get(d.type_id) ?? null : null, has_open_application: openFor.has(d.id) },
      today
    );
    if (s.state === "expired") counts.expired++;
    if (s.state === "expiring") counts.renewNow++;
    if (s.state === "missing") counts.missing++;
    const hit = documentMilestone(s.state, s.daysLeft, s.leadDays);
    if (!hit && !["expired", "expiring", "missing"].includes(s.state)) continue;

    const line: ReminderLine = {
      kind: "document",
      id: d.id,
      title: d.title,
      folder: folderNames.get(d.folder_id) ?? "",
      when:
        s.state === "missing"
          ? "Not held yet"
          : `${describeDays(s.daysLeft)}${s.state === "in_hand" ? " · renewal under way" : ""}${d.expires_on ? ` (${shortDate(d.expires_on)})` : ""}`,
      tone: s.state === "expired" ? "bad" : s.state === "in_hand" ? "quiet" : "warn",
      days: s.daysLeft ?? 9999,
    };
    (hit ? todayLines : open).push(line);
  }

  for (const a of applications) {
    const st = applicationState(a, today);
    if (st === "closed") continue;
    const lodged = !["planned", "gathering"].includes(a.status);
    let hit = false;
    let when = "";
    let days = 9999;
    if (!lodged && a.lodge_by) {
      days = daysBetween(today, a.lodge_by);
      hit = APPLICATION_MILESTONES.includes(days) || (days < 0 && -days % 7 === 0);
      when =
        days < 0
          ? `Lodge-by passed ${-days} ${-days === 1 ? "day" : "days"} ago (${shortDate(a.lodge_by)})`
          : days === 0
            ? "Lodge today"
            : `Lodge by ${shortDate(a.lodge_by)} · ${days} ${days === 1 ? "day" : "days"} left`;
    } else if (lodged && a.expected_on) {
      days = daysBetween(today, a.expected_on);
      hit = days < 0 && -days % 7 === 0;
      when = days < 0 ? `Expected back ${shortDate(a.expected_on)}, not heard yet` : `Expected back ${shortDate(a.expected_on)}`;
    }
    const pressing = st === "late" || st === "due_soon" || st === "overdue";
    if (pressing) counts.applicationsPressing++;
    if (!hit && !pressing) continue;
    const line: ReminderLine = {
      kind: "application",
      id: a.id,
      title: a.title,
      folder: folderNames.get(a.folder_id) ?? "",
      when,
      tone: st === "late" || st === "overdue" ? "bad" : "warn",
      days,
    };
    (hit ? todayLines : open).push(line);
  }

  const byDays = (x: ReminderLine, y: ReminderLine) => x.days - y.days || x.title.localeCompare(y.title);
  return { today: todayLines.sort(byDays), open: open.sort(byDays), counts };
}

/** Monday in Johannesburg, from a YYYY-MM-DD date. */
export function isMonday(today: string): boolean {
  return new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
}

/** Whether today's email goes out at all. */
export function shouldSend(r: Reminder, today: string): boolean {
  return r.today.length > 0 || (isMonday(today) && r.open.length > 0);
}

export function reminderSubject(r: Reminder, today: string): string {
  const n = r.today.length;
  if (n > 0) return `Legal papers: ${n} ${n === 1 ? "thing needs" : "things need"} you today`;
  return isMonday(today) ? `Legal papers: ${r.open.length} still open this week` : "Legal papers";
}

// ────────────────────────────────────────────────────────────
// EMAIL — titles and dates only: no reference numbers, holders or notes
// ────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TONE_COLOUR = { bad: "#B42318", warn: "#8A6400", quiet: "#55524A" } as const;

function linesHtml(lines: ReminderLine[], link: string): string {
  return lines
    .map(
      (l) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #E7E4D9;">
    <a href="${esc(link)}" style="color:#0A0A0A;font-weight:600;text-decoration:none;">${esc(l.title)}</a>
    <div style="font-size:12px;color:#7C786C;">${esc(l.folder)}${l.kind === "application" ? " · application" : ""}</div>
  </td>
  <td style="padding:10px 0 10px 12px;border-bottom:1px solid #E7E4D9;text-align:right;font-size:13px;color:${TONE_COLOUR[l.tone]};white-space:nowrap;">${esc(l.when)}</td>
</tr>`
    )
    .join("\n");
}

export function reminderEmail(r: Reminder, today: string, appUrl: string): { subject: string; html: string; text: string } {
  const link = `${appUrl.replace(/\/$/, "")}/legal-documents`;
  const subject = reminderSubject(r, today);
  const section = (title: string, lines: ReminderLine[]) =>
    lines.length
      ? `<h2 style="font:900 16px/1.2 'Roboto Condensed',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.04em;margin:24px 0 4px;">${esc(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font:14px/1.4 Roboto,Arial,sans-serif;">${linesHtml(lines, link)}</table>`
      : "";
  const html = `<!doctype html><html><body style="margin:0;background:#F4F2EA;">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DEDACE;padding:24px;font:14px/1.5 Roboto,Arial,sans-serif;color:#0A0A0A;">
  <div style="font:700 10px/1 'Roboto Mono',monospace;letter-spacing:0.2em;text-transform:uppercase;color:#55524A;">Legal · Documents</div>
  <h1 style="font:900 28px/1 'Roboto Condensed',Arial,sans-serif;text-transform:uppercase;margin:8px 0 0;">${esc(subject.replace(/^Legal papers: /, ""))}</h1>
  ${section("Today", r.today)}
  ${section(r.today.length ? "Also still open" : "Still open", r.open)}
  <p style="margin:28px 0 0;"><a href="${esc(link)}" style="display:inline-block;background:#0A0A0A;color:#FFFFFF;padding:12px 16px;font:700 11px/1 'Roboto Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;">Open Documents</a></p>
  <p style="margin:20px 0 0;font-size:12px;color:#7C786C;">You get this because you look after FFSA's legal papers in the Hub. Reminders come at 90, 60, 30 and 7 days before something runs out, on the day, and weekly after that.</p>
</div></body></html>`;
  const textLines = (lines: ReminderLine[]) => lines.map((l) => `- ${l.title} (${l.folder}): ${l.when}`).join("\n");
  const text = [
    subject,
    r.today.length ? `\nToday:\n${textLines(r.today)}` : "",
    r.open.length ? `\n${r.today.length ? "Also still open" : "Still open"}:\n${textLines(r.open)}` : "",
    `\nOpen Documents: ${link}`,
  ].join("\n");
  return { subject, html, text };
}
