// Unified "everything attached to this user" fetcher.
// Combines historical CSV records (library_*) with in-app rows
// (application_responses, enrollments, student_payments, orders/tickets,
// reference_requests, consent_records, prayer_room_slot_members) into a
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

const EMPTY: ProfileAttachments = {
  applications: [],
  enrollments: [],
  payments: [],
  tickets: [],
  documents: [],
  references: [],
  consents: [],
  prayerRoom: [],
};

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
    supabase
      .from("prayer_room_slot_members")
      .select(
        "id, role, instrument, created_at, prayer_room_slots:slot_id(slot_date, start_time)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const out: ProfileAttachments = { ...EMPTY };

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
  for (const r of (prayerRes.data ?? []) as AppPrayerRoomMember[]) {
    const slot = r.prayer_room_slots;
    out.prayerRoom.push({
      source: "app",
      id: `app:${r.id}`,
      title: r.role.replace(/_/g, " "),
      subtitle: [r.instrument, slot?.start_time].filter(Boolean).join(" · ") || null,
      date: slot?.slot_date ?? r.created_at,
      dateLabel: "Slot",
    });
  }

  // Sort each list newest first by date (null dates go last).
  const byDateDesc = (a: AttachmentRow, b: AttachmentRow) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
  };

  // Collapse visually-identical CSV rows (typically caused by re-importing
  // the same CSV) into a single row with a count badge. In-app rows are
  // never deduped — they're authoritative individual records.
  out.applications = dedupCsvRows(out.applications).sort(byDateDesc);
  out.enrollments = dedupCsvRows(out.enrollments).sort(byDateDesc);
  out.payments = dedupCsvRows(out.payments).sort(byDateDesc);
  out.tickets.sort(byDateDesc);
  out.documents = dedupCsvRows(out.documents).sort(byDateDesc);
  out.references.sort(byDateDesc);
  out.consents.sort(byDateDesc);
  out.prayerRoom.sort(byDateDesc);

  return out;
}

/**
 * Collapse rows with the same source=csv, libraryPersonId, title, subtitle,
 * dateLabel, date and fileUrl into a single row carrying a `count`. Leaves
 * in-app rows alone — they're authoritative.
 */
function dedupCsvRows(rows: AttachmentRow[]): AttachmentRow[] {
  const byKey = new Map<string, AttachmentRow>();
  const out: AttachmentRow[] = [];
  for (const row of rows) {
    if (row.source !== "csv") {
      out.push(row);
      continue;
    }
    const key = [
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
type AppPrayerRoomMember = {
  id: string;
  role: string;
  instrument: string | null;
  created_at: string;
  prayer_room_slots: {
    slot_date: string | null;
    start_time: string | null;
  } | null;
};
