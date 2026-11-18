import { describe, expect, it } from "vitest";
import { buildReminder, isMonday, reminderEmail, reminderSubject, shouldSend, type ReminderApp, type ReminderDoc } from "./reminders";

// 2026-11-18 is a Wednesday; 2026-11-16 a Monday.
const WED = "2026-11-18";
const MON = "2026-11-16";
const folders = new Map([["f1", "FFSA legal"]]);

const doc = (id: string, expires_on: string | null, over: Partial<ReminderDoc> = {}): ReminderDoc => ({
  id, title: id, folder_id: "f1", type_id: null, expires_on, renew_lead_days: null, status: "held", superseded_by: null, ...over,
});
const app = (id: string, over: Partial<ReminderApp> = {}): ReminderApp => ({
  id, title: id, folder_id: "f1", document_id: null, status: "planned", lodge_by: null, submitted_on: null, expected_on: null, ...over,
});
const build = (today: string, documents: ReminderDoc[], applications: ReminderApp[] = [], lead = new Map<string, number>()) =>
  buildReminder({ today, documents, applications, typeLeadDays: lead, folderNames: folders });
const ids = (lines: { id: string }[]) => lines.map((l) => l.id);

describe("document milestones", () => {
  it("60, 30, 7 and 0 days ahead inside the default 60-day window; not 90 or 59", () => {
    const r = build(WED, [
      doc("d60", "2027-01-17"),
      doc("d30", "2026-12-18"),
      doc("d7", "2026-11-25"),
      doc("d0", "2026-11-18"),
      doc("d59", "2027-01-16"),
      doc("d90", "2027-02-16"),
    ]);
    expect(ids(r.today).sort()).toEqual(["d0", "d30", "d60", "d7"]);
    expect(ids(r.open)).toEqual(["d59"]); // still "renew now", just no milestone today
  });
  it("90 counts when the type's lead time reaches it", () => {
    const r = build(WED, [doc("d90", "2027-02-16", { type_id: "t" })], [], new Map([["t", 120]]));
    expect(ids(r.today)).toEqual(["d90"]);
  });
  it("a short lead time is not nagged early, but 7 and 0 always count", () => {
    const r = build(WED, [
      doc("d30", "2026-12-18", { renew_lead_days: 10 }),
      doc("d7", "2026-11-25", { renew_lead_days: 3 }),
    ]);
    expect(ids(r.today)).toEqual(["d7"]);
  });
  it("expired: every 7 days after", () => {
    const r = build(WED, [doc("x7", "2026-11-11"), doc("x14", "2026-11-04"), doc("x8", "2026-11-10")]);
    expect(ids(r.today).sort()).toEqual(["x14", "x7"]);
    expect(ids(r.open)).toEqual(["x8"]);
    expect(r.counts.expired).toBe(3);
  });
  it("renewal under way: quiet except at 7 days and on the day", () => {
    const apps = [app("a", { document_id: "d30", status: "gathering" }), app("b", { document_id: "d7", status: "submitted" })];
    const r = build(WED, [doc("d30", "2026-12-18"), doc("d7", "2026-11-25")], apps);
    expect(ids(r.today)).toEqual(["d7"]);
    expect(ids(r.open)).not.toContain("d30");
  });
  it("replaced documents never come up", () => {
    const r = build(WED, [doc("old", "2026-11-11", { superseded_by: "new" })]);
    expect(r.today).toEqual([]);
    expect(r.open).toEqual([]);
  });
  it("not held: in the open list, never a milestone", () => {
    const r = build(WED, [doc("m", null, { status: "not_held" })]);
    expect(ids(r.open)).toEqual(["m"]);
    expect(r.counts.missing).toBe(1);
  });
});

describe("application milestones", () => {
  it("14, 7, 1 and 0 days before lodge-by, then weekly while late", () => {
    const r = build(WED, [], [
      app("l14", { lodge_by: "2026-12-02" }),
      app("l7", { lodge_by: "2026-11-25" }),
      app("l1", { lodge_by: "2026-11-19" }),
      app("l0", { lodge_by: "2026-11-18" }),
      app("late7", { lodge_by: "2026-11-11" }),
      app("l10", { lodge_by: "2026-11-28" }),
      app("l30", { lodge_by: "2026-12-18" }),
    ]);
    expect(ids(r.today).sort()).toEqual(["l0", "l1", "l14", "l7", "late7"]);
    expect(ids(r.open)).toEqual(["l10"]); // due soon, no milestone
  });
  it("lodged: only when past the expected date, weekly", () => {
    const r = build(WED, [], [
      app("w", { status: "waiting", lodge_by: "2026-10-01", submitted_on: "2026-10-01", expected_on: "2026-11-11" }),
      app("ok", { status: "submitted", expected_on: "2026-12-01" }),
      app("done", { status: "approved", lodge_by: "2026-11-18" }),
    ]);
    expect(ids(r.today)).toEqual(["w"]);
    expect(ids(r.open)).toEqual([]);
  });
});

describe("sending", () => {
  it("only on a day with something to say; Mondays send the open list", () => {
    const quiet = build(WED, [doc("x8", "2026-11-10")]);
    expect(shouldSend(quiet, WED)).toBe(false);
    expect(isMonday(MON)).toBe(true);
    const monday = build(MON, [doc("x6", "2026-11-10")]);
    expect(monday.today).toEqual([]);
    expect(shouldSend(monday, MON)).toBe(true);
    expect(reminderSubject(monday, MON)).toBe("Legal papers: 1 still open this week");
    expect(shouldSend(build(MON, []), MON)).toBe(false);
  });
  it("subject and email carry titles and dates, escaped, and no other details", () => {
    const r = build(WED, [doc("<b>Lease</b>", "2026-11-18")]);
    expect(reminderSubject(r, WED)).toBe("Legal papers: 1 thing needs you today");
    const e = reminderEmail(r, WED, "https://hub.example/");
    expect(e.html).toContain("&lt;b&gt;Lease&lt;/b&gt;");
    expect(e.html).toContain("https://hub.example/legal-documents");
    expect(e.text).toContain("Expires today (18 Nov)");
  });
});
