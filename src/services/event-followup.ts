import { getActiveSchedulingForEnrollment } from "./scheduling";

// Event Follow-up queue service. Reads workflow_enrollments joined to
// contacts, workflows, outcomes, events, and assigned staff — then
// synthesizes a human-readable "stage" label by combining the latest
// workflow_step_runs entry with the next workflow_steps entry.
//
// The row entity is one workflow_enrollment. A person enrolled in
// multiple workflows shows as multiple rows; this is intentional — each
// row tracks an independent automation chain that may need different
// follow-up.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

type Json = Record<string, unknown> | null;

export type FollowupQueueRow = {
  enrollment_id: string;
  enrolled_at: string;
  status: "active" | "completed" | "cancelled";
  current_step: number;
  next_run_at: string | null;

  assigned_staff_id: string | null;
  staff_assigned_at: string | null;
  staff_viewed_at: string | null;
  marked_finished_at: string | null;

  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
  };

  workflow: { id: string; name: string };
  outcome: { id: string; name: string };
  event: { id: string; title: string };

  assigned_staff: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    email: string | null;
  } | null;

  // Synthesized
  stage_label: string;
  total_steps: number;
  steps_done: number;
  days_in_pipeline: number;
  is_unread: boolean; // true if assigned but staff_viewed_at is null
};

type StepRow = {
  id: string;
  workflow_id: string;
  sort_order: number;
  step_type: "send_email" | "delay" | "assign_label";
  config: Json;
};

type RunRow = {
  enrollment_id: string;
  step_id: string | null;
  status: "done" | "failed" | "skipped";
  ran_at: string;
};

// ─────────────────────────────────────────────────────────────────
// Stage label synthesis (pure function — exported for unit tests)
// ─────────────────────────────────────────────────────────────────

function stepTypeLabel(step: StepRow | null | undefined): string {
  if (!step) return "step";
  switch (step.step_type) {
    case "send_email": {
      const subject =
        (step.config as { subject?: string } | null)?.subject ?? "email";
      return `email "${subject}"`;
    }
    case "delay": {
      const days = (step.config as { days?: number } | null)?.days ?? 0;
      return `${days}-day wait`;
    }
    case "assign_label":
      return "label assignment";
    default:
      return "step";
  }
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function synthesizeStageLabel(args: {
  status: "active" | "completed" | "cancelled";
  current_step: number;
  next_run_at: string | null;
  steps: StepRow[]; // for this enrollment's workflow only, sorted by sort_order
  latestRun: RunRow | null;
  nowIso: string;
}): { label: string; total: number; done: number } {
  const total = args.steps.length;
  const done = Math.min(args.current_step, total);

  if (args.status === "cancelled") {
    return { label: "Cancelled", total, done };
  }
  if (args.status === "completed") {
    return { label: "Workflow complete", total, done };
  }

  const nextStep = args.steps[args.current_step] ?? null;
  const lastStep = args.latestRun?.step_id
    ? args.steps.find((s) => s.id === args.latestRun!.step_id) ?? null
    : null;

  if (!lastStep && nextStep) {
    return {
      label: `Starting · next ${stepTypeLabel(nextStep)}`,
      total,
      done,
    };
  }

  if (lastStep && !nextStep) {
    return { label: `Just ran ${stepTypeLabel(lastStep)}`, total, done };
  }

  if (lastStep && nextStep) {
    let suffix = `next ${stepTypeLabel(nextStep)}`;
    if (nextStep.step_type === "delay" && args.next_run_at) {
      const d = daysBetween(args.nowIso, args.next_run_at);
      if (d > 0) suffix = `waiting ${d}d, ${suffix}`;
    } else if (args.next_run_at) {
      const d = daysBetween(args.nowIso, args.next_run_at);
      if (d > 0) suffix = `${suffix} in ${d}d`;
    }
    return { label: `Sent ${stepTypeLabel(lastStep)} · ${suffix}`, total, done };
  }

  return { label: "Just enrolled", total, done };
}

// ─────────────────────────────────────────────────────────────────
// Queue fetch
// ─────────────────────────────────────────────────────────────────

export async function getFollowupQueue(
  supabase: Client,
  options: {
    accessibleEventIds: Set<string> | null; // null = all events (admin)
  }
): Promise<FollowupQueueRow[]> {
  const q = supabase
    .from("workflow_enrollments")
    .select(
      `
        id, enrolled_at, status, current_step, next_run_at,
        assigned_staff_id, staff_assigned_at, staff_viewed_at, marked_finished_at,
        contact:contacts!workflow_enrollments_contact_id_fkey(
          id, first_name, last_name, preferred_name, email, phone
        ),
        workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(
          id, name,
          outcome:event_outcomes!outcome_workflows_outcome_id_fkey(
            id, name, event_id,
            event:events!event_outcomes_event_id_fkey(id, title)
          )
        ),
        assigned_staff:users!workflow_enrollments_assigned_staff_id_fkey(
          id, first_name, last_name, preferred_name, email
        )
      `
    )
    .eq("status", "active")
    .is("marked_finished_at", null)
    .order("enrolled_at", { ascending: false })
    .limit(200);

  const { data, error } = await q;
  if (error || !data) return [];

  // Shape and filter by accessible events
  type Raw = {
    id: string;
    enrolled_at: string;
    status: "active" | "completed" | "cancelled";
    current_step: number;
    next_run_at: string | null;
    assigned_staff_id: string | null;
    staff_assigned_at: string | null;
    staff_viewed_at: string | null;
    marked_finished_at: string | null;
    contact: FollowupQueueRow["contact"] | null;
    workflow: {
      id: string;
      name: string;
      outcome: {
        id: string;
        name: string;
        event_id: string;
        event: { id: string; title: string } | null;
      } | null;
    } | null;
    assigned_staff: FollowupQueueRow["assigned_staff"] | null;
  };

  const raws = (data as Raw[]).filter((r) => {
    if (!r.contact || !r.workflow?.outcome?.event) return false;
    if (options.accessibleEventIds === null) return true;
    return options.accessibleEventIds.has(r.workflow.outcome.event.id);
  });

  if (raws.length === 0) return [];

  const enrollmentIds = raws.map((r) => r.id);
  const workflowIds = Array.from(
    new Set(raws.map((r) => r.workflow!.id))
  );

  // Fetch workflow steps once for all involved workflows
  const { data: stepsData } = await supabase
    .from("workflow_steps")
    .select("id, workflow_id, sort_order, step_type, config")
    .in("workflow_id", workflowIds)
    .order("sort_order", { ascending: true });

  const stepsByWorkflow = new Map<string, StepRow[]>();
  for (const s of (stepsData ?? []) as StepRow[]) {
    const arr = stepsByWorkflow.get(s.workflow_id) ?? [];
    arr.push(s);
    stepsByWorkflow.set(s.workflow_id, arr);
  }

  // Fetch all step_runs for these enrollments (status='done' only),
  // newest first, then take the latest per enrollment in memory.
  const { data: runsData } = await supabase
    .from("workflow_step_runs")
    .select("enrollment_id, step_id, status, ran_at")
    .in("enrollment_id", enrollmentIds)
    .eq("status", "done")
    .order("ran_at", { ascending: false });

  const latestRunByEnrollment = new Map<string, RunRow>();
  for (const r of (runsData ?? []) as RunRow[]) {
    if (!latestRunByEnrollment.has(r.enrollment_id)) {
      latestRunByEnrollment.set(r.enrollment_id, r);
    }
  }

  const nowIso = new Date().toISOString();
  const rows: FollowupQueueRow[] = raws.map((r) => {
    const steps = stepsByWorkflow.get(r.workflow!.id) ?? [];
    const stage = synthesizeStageLabel({
      status: r.status,
      current_step: r.current_step,
      next_run_at: r.next_run_at,
      steps,
      latestRun: latestRunByEnrollment.get(r.id) ?? null,
      nowIso,
    });

    return {
      enrollment_id: r.id,
      enrolled_at: r.enrolled_at,
      status: r.status,
      current_step: r.current_step,
      next_run_at: r.next_run_at,
      assigned_staff_id: r.assigned_staff_id,
      staff_assigned_at: r.staff_assigned_at,
      staff_viewed_at: r.staff_viewed_at,
      marked_finished_at: r.marked_finished_at,
      contact: r.contact!,
      workflow: { id: r.workflow!.id, name: r.workflow!.name },
      outcome: {
        id: r.workflow!.outcome!.id,
        name: r.workflow!.outcome!.name,
      },
      event: {
        id: r.workflow!.outcome!.event!.id,
        title: r.workflow!.outcome!.event!.title,
      },
      assigned_staff: r.assigned_staff,
      stage_label: stage.label,
      total_steps: stage.total,
      steps_done: stage.done,
      days_in_pipeline: daysBetween(r.enrolled_at, nowIso),
      is_unread: !!r.assigned_staff_id && !r.staff_viewed_at,
    };
  });

  return rows;
}

// ─────────────────────────────────────────────────────────────────
// Detail fetch (drawer)
// ─────────────────────────────────────────────────────────────────

export type FollowupDetail = FollowupQueueRow & {
  form_submission: {
    id: string;
    submitted_at: string;
    raw_data: Record<string, unknown> | null;
  } | null;
  workflow_steps: Array<{
    id: string;
    sort_order: number;
    step_type: string;
    config: Json;
  }>;
  step_runs: Array<{
    id: string;
    step_id: string | null;
    status: string;
    ran_at: string;
    detail: Json;
  }>;
  scheduling: {
    id: string;
    status: "pending" | "awaiting_selection" | "scheduled" | "cancelled";
    duration_minutes: number;
    message: string | null;
    magic_token: string;
    expires_at: string;
    scheduled_at: string | null;
    cancelled_at: string | null;
    created_at: string;
    slots: Array<{
      id: string;
      starts_at: string;
      ends_at: string;
      proposed_by: "recipient" | "team";
      is_chosen: boolean;
    }>;
  } | null;
};

export async function getFollowupDetail(
  supabase: Client,
  enrollmentId: string
): Promise<FollowupDetail | null> {
  const { data: enrollment } = await supabase
    .from("workflow_enrollments")
    .select(
      `
        id, enrolled_at, status, current_step, next_run_at, form_submission_id,
        assigned_staff_id, staff_assigned_at, staff_viewed_at, marked_finished_at,
        contact:contacts!workflow_enrollments_contact_id_fkey(
          id, first_name, last_name, preferred_name, email, phone
        ),
        workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(
          id, name,
          outcome:event_outcomes!outcome_workflows_outcome_id_fkey(
            id, name, event_id,
            event:events!event_outcomes_event_id_fkey(id, title)
          )
        ),
        assigned_staff:users!workflow_enrollments_assigned_staff_id_fkey(
          id, first_name, last_name, preferred_name, email
        )
      `
    )
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return null;

  type EnrollRaw = {
    id: string;
    enrolled_at: string;
    status: "active" | "completed" | "cancelled";
    current_step: number;
    next_run_at: string | null;
    form_submission_id: string | null;
    assigned_staff_id: string | null;
    staff_assigned_at: string | null;
    staff_viewed_at: string | null;
    marked_finished_at: string | null;
    contact: FollowupQueueRow["contact"] | null;
    workflow: {
      id: string;
      name: string;
      outcome: {
        id: string;
        name: string;
        event_id: string;
        event: { id: string; title: string } | null;
      } | null;
    } | null;
    assigned_staff: FollowupQueueRow["assigned_staff"] | null;
  };

  const e = enrollment as unknown as EnrollRaw;
  if (!e.contact || !e.workflow?.outcome?.event) return null;

  const { data: stepsData } = await supabase
    .from("workflow_steps")
    .select("id, workflow_id, sort_order, step_type, config")
    .eq("workflow_id", e.workflow.id)
    .order("sort_order", { ascending: true });

  const steps = (stepsData ?? []) as StepRow[];

  const { data: runsData } = await supabase
    .from("workflow_step_runs")
    .select("id, step_id, status, ran_at, detail")
    .eq("enrollment_id", enrollmentId)
    .order("ran_at", { ascending: true });

  const runs = (runsData ?? []) as Array<{
    id: string;
    step_id: string | null;
    status: string;
    ran_at: string;
    detail: Json;
  }>;

  const latestRun =
    runs.length > 0
      ? ({ ...runs[runs.length - 1], enrollment_id: enrollmentId } as RunRow)
      : null;

  const nowIso = new Date().toISOString();
  const stage = synthesizeStageLabel({
    status: e.status,
    current_step: e.current_step,
    next_run_at: e.next_run_at,
    steps,
    latestRun: latestRun
      ? { ...latestRun, status: latestRun.status as "done" }
      : null,
    nowIso,
  });

  // Optional form_submission fetch
  let formSubmission: FollowupDetail["form_submission"] = null;
  if (e.form_submission_id) {
    const { data: sub } = await supabase
      .from("form_submissions")
      .select("id, submitted_at, raw_data")
      .eq("id", e.form_submission_id)
      .single();
    if (sub) formSubmission = sub as FollowupDetail["form_submission"];
  }

  const scheduling = await getActiveSchedulingForEnrollment(
    supabase,
    enrollmentId
  );

  return {
    enrollment_id: e.id,
    enrolled_at: e.enrolled_at,
    status: e.status,
    current_step: e.current_step,
    next_run_at: e.next_run_at,
    assigned_staff_id: e.assigned_staff_id,
    staff_assigned_at: e.staff_assigned_at,
    staff_viewed_at: e.staff_viewed_at,
    marked_finished_at: e.marked_finished_at,
    contact: e.contact,
    workflow: { id: e.workflow.id, name: e.workflow.name },
    outcome: { id: e.workflow.outcome.id, name: e.workflow.outcome.name },
    event: {
      id: e.workflow.outcome.event.id,
      title: e.workflow.outcome.event.title,
    },
    assigned_staff: e.assigned_staff,
    stage_label: stage.label,
    total_steps: stage.total,
    steps_done: stage.done,
    days_in_pipeline: daysBetween(e.enrolled_at, nowIso),
    is_unread: !!e.assigned_staff_id && !e.staff_viewed_at,
    form_submission: formSubmission,
    workflow_steps: steps.map((s) => ({
      id: s.id,
      sort_order: s.sort_order,
      step_type: s.step_type,
      config: s.config,
    })),
    step_runs: runs,
    scheduling: scheduling
      ? {
          id: scheduling.id,
          status: scheduling.status,
          duration_minutes: scheduling.duration_minutes,
          message: scheduling.message,
          magic_token: scheduling.magic_token,
          expires_at: scheduling.expires_at,
          scheduled_at: scheduling.scheduled_at,
          cancelled_at: scheduling.cancelled_at,
          created_at: scheduling.created_at,
          slots: scheduling.slots.map((s) => ({
            id: s.id,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            proposed_by: s.proposed_by,
            is_chosen: s.is_chosen,
          })),
        }
      : null,
  };
}
