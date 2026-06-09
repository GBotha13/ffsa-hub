// Aggregates EVERYTHING the system knows about one contact into a single
// structured "dossier" for the 360° profile view. Read with the service-role
// admin client (the profile page is admin-gated and already enforces contact
// visibility) — same pattern the rest of the app uses for these tables.
//
// Every slice degrades gracefully: a failing query yields an empty list rather
// than breaking the whole profile.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// Per-section row cap. Without this, a long-tenured contact pulls every event,
// email, call, order, and form they have ever touched on every profile load.
// 50 is enough for the recent-history view; deeper history can move to a paged
// drill-in later if needed.
const DOSSIER_LIMIT = 50;

export type DossierEvent = {
  eventId: string | null;
  title: string;
  startDate: string | null;
  registrationStatus: string | null;
  attendanceStatus: string | null;
  roles: string[];
};

export type DossierOutcome = {
  name: string;
  eventTitle: string | null;
  respondedAt: string | null;
};

export type DossierWorkflow = {
  id: string;
  name: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  currentStepType: string | null;
  enrolledAt: string | null;
  nextRunAt: string | null;
  completedAt: string | null;
};

export type DossierEmail = {
  source: "workflow" | "campaign";
  label: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
};

export type DossierCall = {
  status: string;
  durationMinutes: number | null;
  message: string | null;
  createdAt: string | null;
  scheduledStart: string | null;
};

export type DossierFormAnswer = { key: string; value: string };
export type DossierForm = {
  id: string;
  formName: string;
  submittedAt: string | null;
  answers: DossierFormAnswer[];
};

export type DossierOrder = {
  status: string;
  totalCents: number | null;
  currency: string | null;
  createdAt: string | null;
  paidAt: string | null;
  eventTitle: string | null;
};

export type DossierApplication = {
  programName: string;
  status: string; // submitted | accepted | rejected | waitlisted
  submittedAt: string | null;
};

export type DossierEnrollment = {
  programName: string;
  status: string; // active | completed | withdrawn | on_hold
  enrolledAt: string | null;
  completedAt: string | null;
};

export type ContactDossier = {
  events: DossierEvent[];
  outcomes: DossierOutcome[];
  workflows: DossierWorkflow[];
  emails: DossierEmail[];
  calls: DossierCall[];
  forms: DossierForm[];
  orders: DossierOrder[];
  applications: DossierApplication[];
  enrollments: DossierEnrollment[];
  counts: {
    events: number;
    outcomes: number;
    workflows: number;
    emails: number;
    calls: number;
    forms: number;
    orders: number;
    schools: number;
  };
};

export async function getContactDossier(
  supabase: Client,
  contactId: string
): Promise<ContactDossier> {
  const [
    events,
    outcomes,
    workflows,
    emails,
    calls,
    forms,
    orders,
    schools,
  ] = await Promise.all([
    fetchEvents(supabase, contactId),
    fetchOutcomes(supabase, contactId),
    fetchWorkflows(supabase, contactId),
    fetchEmails(supabase, contactId),
    fetchCalls(supabase, contactId),
    fetchForms(supabase, contactId),
    fetchOrders(supabase, contactId),
    fetchSchools(supabase, contactId),
  ]);

  return {
    events,
    outcomes,
    workflows,
    emails,
    calls,
    forms,
    orders,
    applications: schools.applications,
    enrollments: schools.enrollments,
    counts: {
      events: events.length,
      outcomes: outcomes.length,
      workflows: workflows.length,
      emails: emails.length,
      calls: calls.length,
      forms: forms.length,
      orders: orders.length,
      schools: schools.applications.length + schools.enrollments.length,
    },
  };
}

// ── Events: merge registrations + attendance + roles, one row per event ──
async function fetchEvents(
  supabase: Client,
  contactId: string
): Promise<DossierEvent[]> {
  const byEvent = new Map<string, DossierEvent>();
  const keyFor = (ev: { id?: string | null; title?: string | null } | null) =>
    ev?.id ?? `title:${ev?.title ?? "unknown"}`;

  const upsert = (
    ev: { id?: string | null; title?: string | null; start_date?: string | null } | null,
    patch: Partial<DossierEvent>
  ) => {
    if (!ev) return;
    const k = keyFor(ev);
    const existing =
      byEvent.get(k) ??
      ({
        eventId: ev.id ?? null,
        title: ev.title ?? "Untitled event",
        startDate: ev.start_date ?? null,
        registrationStatus: null,
        attendanceStatus: null,
        roles: [],
      } as DossierEvent);
    byEvent.set(k, { ...existing, ...patch });
  };

  const [regs, atts, roles] = await Promise.all([
    safe(supabase, "event_registrations", (q: Client) =>
      q
        .select("status, registered_at, events(id, title, start_date)")
        .eq("contact_id", contactId)
        .order("registered_at", { ascending: false, nullsFirst: false })
        .limit(DOSSIER_LIMIT)
    ),
    safe(supabase, "attendance_records", (q: Client) =>
      q
        .select("status, checked_in_at, events(id, title, start_date)")
        .eq("contact_id", contactId)
        .order("checked_in_at", { ascending: false, nullsFirst: false })
        .limit(DOSSIER_LIMIT)
    ),
    safe(supabase, "event_roles", (q: Client) =>
      q
        .select("role_name, events(id, title, start_date)")
        .eq("contact_id", contactId)
        .limit(DOSSIER_LIMIT)
    ),
  ]);

  for (const r of regs) upsert(r.events, { registrationStatus: r.status });
  for (const a of atts) upsert(a.events, { attendanceStatus: a.status });
  for (const r of roles) {
    if (!r.events) continue;
    const k = keyFor(r.events);
    upsert(r.events, {});
    const row = byEvent.get(k);
    if (row && r.role_name && !row.roles.includes(r.role_name)) {
      row.roles.push(r.role_name);
    }
  }

  return Array.from(byEvent.values()).sort((a, b) =>
    (b.startDate ?? "").localeCompare(a.startDate ?? "")
  );
}

async function fetchOutcomes(
  supabase: Client,
  contactId: string
): Promise<DossierOutcome[]> {
  const rows = await safe(supabase, "event_outcome_responses", (q: Client) =>
    q
      .select("responded_at, event_outcomes(name, events(title))")
      .eq("contact_id", contactId)
      .order("responded_at", { ascending: false, nullsFirst: false })
      .limit(DOSSIER_LIMIT)
  );
  return rows
    .map((r: Client) => ({
      name: r.event_outcomes?.name ?? "Outcome",
      eventTitle: r.event_outcomes?.events?.title ?? null,
      respondedAt: r.responded_at ?? null,
    }))
    .sort((a: DossierOutcome, b: DossierOutcome) =>
      (b.respondedAt ?? "").localeCompare(a.respondedAt ?? "")
    );
}

async function fetchWorkflows(
  supabase: Client,
  contactId: string
): Promise<DossierWorkflow[]> {
  const rows = await safe(supabase, "workflow_enrollments", (q: Client) =>
    q
      .select(
        "id, status, current_step, enrolled_at, next_run_at, completed_at, workflow_id, outcome_workflows(name)"
      )
      .eq("contact_id", contactId)
      .order("enrolled_at", { ascending: false, nullsFirst: false })
      .limit(DOSSIER_LIMIT)
  );
  if (rows.length === 0) return [];

  // One query for the steps of every involved workflow → derive stage.
  const workflowIds = Array.from(
    new Set(rows.map((r: Client) => r.workflow_id).filter(Boolean))
  );
  const stepsByWorkflow = new Map<string, Array<{ sort_order: number; step_type: string }>>();
  if (workflowIds.length > 0) {
    const steps = await safe(supabase, "workflow_steps", (q: Client) =>
      q
        .select("workflow_id, sort_order, step_type")
        .in("workflow_id", workflowIds)
        .order("sort_order", { ascending: true })
    );
    for (const s of steps) {
      const arr = stepsByWorkflow.get(s.workflow_id) ?? [];
      arr.push({ sort_order: s.sort_order, step_type: s.step_type });
      stepsByWorkflow.set(s.workflow_id, arr);
    }
  }

  return rows
    .map((r: Client) => {
      const steps = stepsByWorkflow.get(r.workflow_id) ?? [];
      return {
        id: r.id,
        name: r.outcome_workflows?.name ?? "Workflow",
        status: r.status,
        currentStep: r.current_step ?? 0,
        totalSteps: steps.length,
        currentStepType: steps[r.current_step ?? 0]?.step_type ?? null,
        enrolledAt: r.enrolled_at ?? null,
        nextRunAt: r.next_run_at ?? null,
        completedAt: r.completed_at ?? null,
      } as DossierWorkflow;
    })
    .sort((a: DossierWorkflow, b: DossierWorkflow) =>
      (b.enrolledAt ?? "").localeCompare(a.enrolledAt ?? "")
    );
}

async function fetchEmails(
  supabase: Client,
  contactId: string
): Promise<DossierEmail[]> {
  const [wf, camp] = await Promise.all([
    safe(supabase, "workflow_email_sends", (q: Client) =>
      q
        .select(
          "sent_at, opened_at, first_clicked_at, bounced_at, outcome_workflows(name)"
        )
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(DOSSIER_LIMIT)
    ),
    safe(supabase, "campaign_recipients", (q: Client) =>
      q
        .select(
          "sent_at, opened_at, first_clicked_at, bounced_at, campaigns(name, subject)"
        )
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(DOSSIER_LIMIT)
    ),
  ]);

  const emails: DossierEmail[] = [
    ...wf.map((e: Client) => ({
      source: "workflow" as const,
      label: e.outcome_workflows?.name
        ? `${e.outcome_workflows.name} (automated)`
        : "Automated email",
      sentAt: e.sent_at ?? null,
      openedAt: e.opened_at ?? null,
      clickedAt: e.first_clicked_at ?? null,
      bouncedAt: e.bounced_at ?? null,
    })),
    ...camp.map((e: Client) => ({
      source: "campaign" as const,
      label:
        e.campaigns?.subject || e.campaigns?.name || "Campaign email",
      sentAt: e.sent_at ?? null,
      openedAt: e.opened_at ?? null,
      clickedAt: e.first_clicked_at ?? null,
      bouncedAt: e.bounced_at ?? null,
    })),
  ];

  return emails
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))
    .slice(0, DOSSIER_LIMIT);
}

async function fetchCalls(
  supabase: Client,
  contactId: string
): Promise<DossierCall[]> {
  const rows = await safe(supabase, "scheduling_requests", (q: Client) =>
    q
      .select(
        "status, duration_minutes, message, created_at, scheduling_slots(starts_at, is_chosen)"
      )
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(DOSSIER_LIMIT)
  );
  return rows
    .map((r: Client) => {
      const chosen = (r.scheduling_slots ?? []).find((s: Client) => s.is_chosen);
      return {
        status: r.status,
        durationMinutes: r.duration_minutes ?? null,
        message: r.message ?? null,
        createdAt: r.created_at ?? null,
        scheduledStart: chosen?.starts_at ?? null,
      } as DossierCall;
    })
    .sort((a: DossierCall, b: DossierCall) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );
}

async function fetchForms(
  supabase: Client,
  contactId: string
): Promise<DossierForm[]> {
  const rows = await safe(supabase, "form_submissions", (q: Client) =>
    q
      .select("id, submitted_at, raw_data, forms(name)")
      .eq("contact_id", contactId)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(DOSSIER_LIMIT)
  );
  return rows
    .map((r: Client) => ({
      id: r.id,
      formName: r.forms?.name ?? "Form",
      submittedAt: r.submitted_at ?? null,
      answers: rawDataToAnswers(r.raw_data),
    }))
    .sort((a: DossierForm, b: DossierForm) =>
      (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")
    );
}

async function fetchOrders(
  supabase: Client,
  contactId: string
): Promise<DossierOrder[]> {
  const rows = await safe(supabase, "orders", (q: Client) =>
    q
      .select("status, total_cents, currency, created_at, paid_at, events(title)")
      .eq("buyer_contact_id", contactId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(DOSSIER_LIMIT)
  );
  return rows
    .map((r: Client) => ({
      status: r.status,
      totalCents: r.total_cents ?? null,
      currency: r.currency ?? null,
      createdAt: r.created_at ?? null,
      paidAt: r.paid_at ?? null,
      eventTitle: r.events?.title ?? null,
    }))
    .sort((a: DossierOrder, b: DossierOrder) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );
}

// Schools — applications (application_responses) + enrollments belong to a
// school applicant's USER account. In practice users.contact_id is NOT
// populated, so the real link to a CRM contact is the EMAIL: match users whose
// email equals any of the contact's emails (primary cache + every
// contact_emails row), and still honour users.contact_id if it's ever set.
// The users table is small (staff + applicants), so matching in memory is
// cheap — and we compare normalized emails exactly rather than with ilike,
// since emails can contain "_" (a SQL LIKE wildcard).
async function fetchSchools(
  supabase: Client,
  contactId: string
): Promise<{
  applications: DossierApplication[];
  enrollments: DossierEnrollment[];
}> {
  const [contactRows, emailRows, users] = await Promise.all([
    safe(supabase, "contacts", (q: Client) =>
      q.select("email").eq("id", contactId)
    ),
    safe(supabase, "contact_emails", (q: Client) =>
      q.select("email").eq("contact_id", contactId)
    ),
    safe(supabase, "users", (q: Client) => q.select("id, email, contact_id")),
  ]);

  const emails = new Set<string>();
  for (const r of contactRows)
    if (r.email) emails.add(String(r.email).trim().toLowerCase());
  for (const r of emailRows)
    if (r.email) emails.add(String(r.email).trim().toLowerCase());

  const userIds = users
    .filter(
      (u: Client) =>
        u.contact_id === contactId ||
        (u.email && emails.has(String(u.email).trim().toLowerCase()))
    )
    .map((u: Client) => u.id)
    .filter(Boolean);
  if (userIds.length === 0) return { applications: [], enrollments: [] };

  const [apps, enrolls] = await Promise.all([
    safe(supabase, "application_responses", (q: Client) =>
      q
        .select("status, submitted_at, programs(name)")
        .in("user_id", userIds)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(DOSSIER_LIMIT)
    ),
    safe(supabase, "enrollments", (q: Client) =>
      q
        .select("status, enrolled_at, completed_at, programs(name)")
        .in("user_id", userIds)
        .order("enrolled_at", { ascending: false, nullsFirst: false })
        .limit(DOSSIER_LIMIT)
    ),
  ]);

  return {
    applications: apps
      .map((a: Client) => ({
        programName: a.programs?.name ?? "Program",
        status: a.status,
        submittedAt: a.submitted_at ?? null,
      }))
      .sort((a: DossierApplication, b: DossierApplication) =>
        (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")
      ),
    enrollments: enrolls
      .map((e: Client) => ({
        programName: e.programs?.name ?? "Program",
        status: e.status,
        enrolledAt: e.enrolled_at ?? null,
        completedAt: e.completed_at ?? null,
      }))
      .sort((a: DossierEnrollment, b: DossierEnrollment) =>
        (b.enrolledAt ?? "").localeCompare(a.enrolledAt ?? "")
      ),
  };
}

// ── helpers ──

// Run a select against `table`, returning rows or [] on any error so one bad
// slice never breaks the whole dossier.
async function safe(
  supabase: Client,
  table: string,
  build: (q: Client) => Client
): Promise<Client[]> {
  try {
    const { data, error } = await build(supabase.from(table));
    if (error) {
      console.warn(`[contact-dossier] ${table}: ${error.message}`);
      return [];
    }
    return (data ?? []) as Client[];
  } catch (e) {
    console.warn(`[contact-dossier] ${table}: ${(e as Error).message}`);
    return [];
  }
}

// Turn a form submission's raw_data into readable answers. Field keys like
// "field_mpjf..." are kept as-is (the per-form Responses view maps labels); we
// at least surface human keys (email, first_name) cleanly.
function rawDataToAnswers(raw: unknown): DossierFormAnswer[] {
  if (!raw || typeof raw !== "object") return [];
  const out: DossierFormAnswer[] = [];
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val == null || val === "") continue;
    let value: string;
    if (typeof val === "boolean") value = val ? "Yes" : "No";
    else if (Array.isArray(val)) value = val.join(", ");
    else if (typeof val === "object") value = JSON.stringify(val);
    else value = String(val);
    const label = key
      .replace(/^field_[a-z0-9]+_?/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    out.push({ key: label || key, value });
  }
  return out;
}
