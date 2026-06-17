// Unified "everything attached to this user" fetcher.
// Combines historical CSV records (library_*) with in-app rows
// (application_responses, enrollments, student_payments, orders/tickets,
// reference_requests, consent_records, prayer_room_set_slots) into a
// single tagged feed that the profile UI groups and renders.

import { getUserHistory } from "./records-library";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type AttachmentSource = "csv" | "app";

export type AttachmentRow = {
  source: AttachmentSource;
  id: string;
  title: string;
  subtitle?: string | null;
  /** ISO date string used for sorting (newest first). null = unknown */
  date: string | null;
  /** label rendered next to the date, e.g. "Submitted", "Paid", "Enrolled" */
  dateLabel?: string;
  /** Optional file/download link (for documents). */
  fileUrl?: string | null;
  /** Source library_persons.id for CSV-sourced rows so staff can deep-link. */
  libraryPersonId?: string | null;
  /**
   * When >1, this row represents N visually-identical records that were
   * collapsed in the display (typically dupes from re-importing the same
   * CSV). Clicking through still drills into the underlying library_person.
   */
  count?: number;
};

export type ProfileAttachments = {
  applications: AttachmentRow[];
  enrollments: AttachmentRow[];
  payments: AttachmentRow[];
  tickets: AttachmentRow[];
  documents: AttachmentRow[];
  references: AttachmentRow[];
  consents: AttachmentRow[];
  prayerRoom: AttachmentRow[];
};

// MUST return a brand-new object with NEW arrays on every call. A shared
// module-level constant here is fatal: the out.X.push(...) calls below mutate
// it in place, so on a warm server the arrays accumulate across every request
// (and across users) — that was the cause of the ever-growing ×N counts and
// potential cross-user record bleed.
function emptyAttachments(): ProfileAttachments {
  return {
    applications: [],
    enrollments: [],
    payments: [],
    tickets: [],
    documents: [],
    references: [],
    consents: [],
    prayerRoom: [],
  };
}

// day_of_week is 0=Sunday..6=Saturday (matches prayer_room template blocks).
const DAY_PLURAL = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
] as const;

/** "07:00:00" → "07:00"; renders a start–end range, or whichever side exists. */
function formatTimeRange(
  start: string | null,
  end: string | null
): string | null {
  const hhmm = (s: string | null) => (s ? s.slice(0, 5) : null);
  const a = hhmm(start);
  const b = hhmm(end);
  if (a && b) return `${a}–${b}`;
  return a ?? b ?? null;
}

export async function getProfileAttachments(
  supabase: Client,
  userId: string
): Promise<ProfileAttachments> {
  // We need the user's email for the tickets lookup (orders link by
  // buyer_email rather than user_id, because the buyer may not have a
  // user account at purchase time).
  const userRes = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const userEmail: string | null =
    typeof userRes?.data?.email === "string"
      ? (userRes.data.email as string).toLowerCase()
      : null;

  const [
    csv,
    appsRes,
    enrollsRes,
    paysRes,
    ticketsRes,
    consentsRes,
    refsRes,
    prayerRes,
    prayerOwnedRes,
  ] = await Promise.all([
    getUserHistory(supabase, userId),
    supabase
      .from("application_responses")
      .select("id, status, submitted_at, programs:program_id(name, code)")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select(
        "id, status, enrolled_at, completed_at, programs:program_id(name, code)"
      )
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("student_payments")
      .select(
        "id, amount_zar, payment_date, payment_method, reference, student_fees!inner(user_id, programs:program_id(name))"
      )
      .eq("student_fees.user_id", userId)
      .order("payment_date", { ascending: false }),
    userEmail
      ? supabase
          .from("tickets")
          .select(
            "id, code, status, created_at, ticket_types:ticket_type_id(name), events:event_id(title, start_date), orders:order_id!inner(buyer_email, total_cents, currency, paid_at, status)"
          )
          .eq("orders.buyer_email", userEmail)
          .eq("orders.status", "paid")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("consent_records")
      .select("id, agreement_version, source, accepted_at")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false }),
    // References are about a user via their application_responses.
    supabase
      .from("reference_requests")
      .select(
        "id, referee_name, referee_email, status, submitted_at, created_at, application_responses!inner(user_id, programs:program_id(name))"
      )
      .eq("application_responses.user_id", userId)
      .order("created_at", { ascending: false }),
    // Prayer room (1/2): sessions this user is rostered INTO (filled roster
    // slots), joined to the parent set and its weekly template block so a
    // recurring serve collapses into one summary row.
    supabase
      .from("prayer_room_set_slots")
      .select(
        "id, role, set:set_id(id, set_date, start_time, end_time, title, template_block_id, block:template_block_id(day_of_week, start_time, end_time, title))"
      )
      .eq("filled_user_id", userId)
      .order("created_at", { ascending: false }),
    // Prayer room (2/2): sets this user OWNS (leads) — so a session you
    // scheduled shows up even before you've rostered yourself into a role.
    supabase
      .from("prayer_room_sets")
      .select(
        "id, set_date, start_time, end_time, title, template_block_id, block:template_block_id(day_of_week, start_time, end_time, title)"
      )
      .eq("owner_id", userId)
      .neq("status", "cancelled")
      .order("set_date", { ascending: false }),
  ]);

  const out: ProfileAttachments = emptyAttachments();

  // ── Applications (CSV + app) ──────────────────────────────
  for (const r of csv.applications as CsvApp[]) {
    out.applications.push({
      source: "csv",
      id: `csv:${r.id}`,
      title: r.program_name ?? "Application",
      subtitle: [r.cohort, r.status].filter(Boolean).join(" · ") || null,
      date: r.submitted_at,
      dateLabel: "Submitted",
      libraryPersonId: r.person_id,
    });
  }
  for (const r of (appsRes.data ?? []) as AppApplication[]) {
    out.applications.push({
      source: "app",
      id: `app:${r.id}`,
      title:
        r.programs?.name ?? (r.programs?.code ? `Program ${r.programs.code}` : "Application"),
      subtitle: r.status ?? null,
      date: r.submitted_at,
      dateLabel: "Submitted",
    });
  }

  // ── Enrollments (CSV + app) ───────────────────────────────
  for (const r of csv.enrollments as CsvEnroll[]) {
    out.enrollments.push({
      source: "csv",
      id: `csv:${r.id}`,
      title: r.school_name ?? r.program_name ?? "Enrollment",
      subtitle: [r.program_name, r.role].filter(Boolean).join(" · ") || null,
      date: r.start_date,
      dateLabel: "Started",
      libraryPersonId: r.person_id,
    });
  }
  for (const r of (enrollsRes.data ?? []) as AppEnrollment[]) {
    out.enrollments.push({
      source: "app",
      id: `app:${r.id}`,
      title: r.programs?.name ?? "Enrollment",
      subtitle: r.status ?? null,
      date: r.enrolled_at,
      dateLabel: r.completed_at ? "Completed" : "Enrolled",
    });
  }

  // ── Payments (CSV + app) ──────────────────────────────────
  for (const r of csv.payments as CsvPayment[]) {
    out.payments.push({
      source: "csv",
      id: `csv:${r.id}`,
      title:
        r.amount != null
          ? `${r.currency ?? ""} ${r.amount}`.trim()
          : "Payment",
      subtitle: r.description ?? null,
      date: r.paid_at,
      dateLabel: "Paid",
      libraryPersonId: r.person_id,
    });
  }
  for (const r of (paysRes.data ?? []) as AppPayment[]) {
    out.payments.push({
      source: "app",
      id: `app:${r.id}`,
      title: `ZAR ${r.amount_zar.toLocaleString()}`,
      subtitle: [r.student_fees?.programs?.name, r.payment_method, r.reference]
        .filter(Boolean)
        .join(" · ") || null,
      date: r.payment_date,
      dateLabel: "Paid",
    });
  }

  // ── Tickets (app only — joined via buyer_email) ───────────
  for (const r of (ticketsRes.data ?? []) as AppTicket[]) {
    const order = r.orders;
    const amount =
      order && typeof order.total_cents === "number"
        ? `${order.currency ?? "ZAR"} ${(order.total_cents / 100).toLocaleString()}`
        : "Ticket";
    out.tickets.push({
      source: "app",
      id: `app:${r.id}`,
      title: r.events?.title ?? "Event ticket",
      subtitle: [r.ticket_types?.name, amount, r.status]
        .filter(Boolean)
        .join(" · ") || null,
      date: order?.paid_at ?? r.created_at,
      dateLabel: "Purchased",
    });
  }

  // ── Documents (CSV only for now) ──────────────────────────
  for (const r of csv.documents as CsvDocument[]) {
    out.documents.push({
      source: "csv",
      id: `csv:${r.id}`,
      title: r.doc_type ?? "Document",
      subtitle: r.identifier ?? null,
      date: r.expires_at,
      dateLabel: "Expires",
      fileUrl: r.file_url,
      libraryPersonId: r.person_id,
    });
  }

  // ── References (about this user, app only) ────────────────
  for (const r of (refsRes.data ?? []) as AppReference[]) {
    const programName = r.application_responses?.programs?.name;
    out.references.push({
      source: "app",
      id: `app:${r.id}`,
      title: r.referee_name,
      subtitle: [programName, r.status, r.referee_email]
        .filter(Boolean)
        .join(" · ") || null,
      date: r.submitted_at ?? r.created_at,
      dateLabel: r.submitted_at ? "Submitted" : "Requested",
    });
  }

  // ── Consents (app only) ───────────────────────────────────
  for (const r of (consentsRes.data ?? []) as AppConsent[]) {
    out.consents.push({
      source: "app",
      id: `app:${r.id}`,
      title: `Agreement ${r.agreement_version}`,
      subtitle: r.source,
      date: r.accepted_at,
      dateLabel: "Accepted",
    });
  }

  // ── Prayer room (app only) ────────────────────────────────
  // Two relationships surface here: sets the user OWNS (leads) and roster
  // slots the user is FILLED into (serves). Both fold into ONE row per
  // recurring commitment — grouped by weekly template block, or per set for
  // ad-hoc ones — so a weekly serve/lead doesn't render as N near-identical
  // rows. The row title states the relationship ("Leading", the role, or both).
  type PrayerGroup = {
    isOwner: boolean;
    roles: Set<string>;
    dayOfWeek: number | null;
    startTime: string | null;
    endTime: string | null;
    dates: Set<string>;
  };
  const prayerGroups = new Map<string, PrayerGroup>();
  const prayerGroup = (
    key: string,
    block: AppPrayerBlock | null,
    src: { start_time: string | null; end_time: string | null }
  ): PrayerGroup => {
    let g = prayerGroups.get(key);
    if (!g) {
      g = {
        isOwner: false,
        roles: new Set<string>(),
        dayOfWeek: block?.day_of_week ?? null,
        startTime: block?.start_time ?? src.start_time,
        endTime: block?.end_time ?? src.end_time,
        dates: new Set<string>(),
      };
      prayerGroups.set(key, g);
    }
    return g;
  };
  // Sets the user owns (leads). Ad-hoc sets (no template block) key by set id;
  // template-born sets key by block so recurring weeks fold together.
  for (const s of (prayerOwnedRes.data ?? []) as AppPrayerOwnedSet[]) {
    const block = s.template_block_id ? s.block : null;
    const g = prayerGroup(s.template_block_id ?? `adhoc:${s.id}`, block, s);
    g.isOwner = true;
    if (s.set_date) g.dates.add(s.set_date);
  }
  // Roster slots the user is filled into (serves) — merges with an owned group
  // when it's the same set/block (so leading + serving show on one row).
  for (const r of (prayerRes.data ?? []) as AppPrayerRosterSlot[]) {
    const set = r.set;
    if (!set) continue;
    const block = set.template_block_id ? set.block : null;
    const g = prayerGroup(set.template_block_id ?? `adhoc:${set.id}`, block, set);
    g.roles.add(r.role);
    if (set.set_date) g.dates.add(set.set_date);
  }
  const todayStr = new Date().toISOString().split("T")[0];
  for (const [key, g] of prayerGroups) {
    const dates = [...g.dates].sort();
    const next = dates.find((d) => d >= todayStr);
    const recurrence =
      g.dayOfWeek != null ? `Weekly · ${DAY_PLURAL[g.dayOfWeek]}` : null;
    const times = formatTimeRange(g.startTime, g.endTime);
    const relationship =
      [g.isOwner ? "Leading" : null, ...[...g.roles].map((r) => r.replace(/_/g, " "))]
        .filter(Boolean)
        .join(" · ") || "Prayer room";
    const subtitle =
      [recurrence, times, dates.length > 1 ? `${dates.length} sessions` : null]
        .filter(Boolean)
        .join(" · ") || null;
    out.prayerRoom.push({
      source: "app",
      id: `app:prayer:${key}`,
      title: relationship,
      subtitle,
      date: next ?? dates[dates.length - 1] ?? null,
      dateLabel: next ? "Next" : "Last",
    });
  }

  // Sort each list newest first by date (null dates go last).
  const byDateDesc = (a: AttachmentRow, b: AttachmentRow) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
  };

  // Collapse visually-identical rows into one ×N row so no section balloons
  // into duplicate lines — CSV re-imports AND genuine multiples (e.g. many
  // identical event tickets). Applied to every section. See collapseDuplicates.
  out.applications = collapseDuplicates(out.applications).sort(byDateDesc);
  out.enrollments = collapseDuplicates(out.enrollments).sort(byDateDesc);
  out.payments = collapseDuplicates(out.payments).sort(byDateDesc);
  out.tickets = collapseDuplicates(out.tickets).sort(byDateDesc);
  out.documents = collapseDuplicates(out.documents).sort(byDateDesc);
  out.references = collapseDuplicates(out.references).sort(byDateDesc);
  out.consents = collapseDuplicates(out.consents).sort(byDateDesc);
  out.prayerRoom = collapseDuplicates(out.prayerRoom).sort(byDateDesc);

  return out;
}

/**
 * Collapse visually-identical rows into a single row carrying a `count`
 * (rendered as a ×N badge). Rows match when their source, libraryPersonId,
 * title, subtitle, dateLabel, date and fileUrl are all equal — i.e. they'd
 * render the exact same line.
 *
 * Applies to BOTH in-app and CSV rows: a CSV record re-imported N times and a
 * genuine multiple (e.g. several identical event tickets) both collapse, so no
 * section ever balloons into a wall of duplicate lines. `source` is part of the
 * key, so an Imported row never merges with an In-app one (their badges differ).
 */
function collapseDuplicates(rows: AttachmentRow[]): AttachmentRow[] {
  const byKey = new Map<string, AttachmentRow>();
  const out: AttachmentRow[] = [];
  for (const row of rows) {
    const key = [
      row.source,
      row.libraryPersonId ?? "",
      row.title ?? "",
      row.subtitle ?? "",
      row.dateLabel ?? "",
      row.date ?? "",
      row.fileUrl ?? "",
    ].join("|");
    const existing = byKey.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
    } else {
      const cloned: AttachmentRow = { ...row, count: 1 };
      byKey.set(key, cloned);
      out.push(cloned);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Internal row types (matches the SELECT statements above)
// ────────────────────────────────────────────────────────────

type CsvApp = {
  id: string;
  person_id: string;
  program_name: string | null;
  cohort: string | null;
  status: string | null;
  submitted_at: string | null;
};
type CsvEnroll = {
  id: string;
  person_id: string;
  school_name: string | null;
  program_name: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
};
type CsvPayment = {
  id: string;
  person_id: string;
  amount: number | null;
  currency: string | null;
  description: string | null;
  paid_at: string | null;
};
type CsvDocument = {
  id: string;
  person_id: string;
  doc_type: string | null;
  identifier: string | null;
  expires_at: string | null;
  file_url: string | null;
};

type AppApplication = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  programs: { name: string | null; code: string | null } | null;
};
type AppEnrollment = {
  id: string;
  status: string | null;
  enrolled_at: string | null;
  completed_at: string | null;
  programs: { name: string | null; code: string | null } | null;
};
type AppPayment = {
  id: string;
  amount_zar: number;
  payment_date: string | null;
  payment_method: string | null;
  reference: string | null;
  student_fees: { programs: { name: string | null } | null } | null;
};
type AppTicket = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  ticket_types: { name: string | null } | null;
  events: { title: string | null; start_date: string | null } | null;
  orders: {
    buyer_email: string | null;
    total_cents: number | null;
    currency: string | null;
    paid_at: string | null;
    status: string | null;
  } | null;
};
type AppReference = {
  id: string;
  referee_name: string;
  referee_email: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  application_responses: {
    user_id: string;
    programs: { name: string | null } | null;
  } | null;
};
type AppConsent = {
  id: string;
  agreement_version: string;
  source: string;
  accepted_at: string;
};
type AppPrayerBlock = {
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
};
type AppPrayerRosterSlot = {
  id: string;
  role: string;
  set: {
    id: string;
    set_date: string | null;
    start_time: string | null;
    end_time: string | null;
    title: string | null;
    template_block_id: string | null;
    block: AppPrayerBlock | null;
  } | null;
};
type AppPrayerOwnedSet = {
  id: string;
  set_date: string | null;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  template_block_id: string | null;
  block: AppPrayerBlock | null;
};
