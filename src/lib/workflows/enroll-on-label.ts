// ============================================================
// Label-based enrollment
// ============================================================
// When a label is added to a contact, enroll them into any active
// workflow on an outcome that carries that label and whose trigger
// is {type:'label_added'}. Runs the first (instant) steps inline.
//
// Uses its own service-role client so it works from any caller
// context (RLS-independent). Guards against workflow-driven label
// adds to prevent assign_label steps from looping.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveEnrollment, createEnrollment } from "@/services/workflows";
import { runEnrollment } from "@/lib/workflows/runner";
import { logActivity } from "@/services/activity-events";
import type { WorkflowTrigger } from "@/lib/workflows/types";

export async function enrollOnLabelAdded(args: {
  contactId: string;
  labelId: string;
  addedVia?: string | null;
}): Promise<void> {
  // Prevent loops: a workflow's assign_label step must not enroll into more
  // workflows.
  if (args.addedVia && args.addedVia.startsWith("workflow:")) return;

  const admin = createAdminClient();

  // Outcomes whose label is the one just added.
  const { data: outcomes } = await admin
    .from("event_outcomes")
    .select("id")
    .eq("label_id", args.labelId);
  const outcomeIds = (outcomes ?? []).map((o: { id: string }) => o.id);
  if (outcomeIds.length === 0) return;

  // Active workflows on those outcomes.
  const { data: wfs } = await admin
    .from("outcome_workflows")
    .select("id, name, trigger")
    .in("outcome_id", outcomeIds)
    .eq("is_active", true);

  for (const wf of (wfs ?? []) as Array<{
    id: string;
    name: string;
    trigger: unknown;
  }>) {
    const trigger = wf.trigger as WorkflowTrigger | null;
    if (!trigger || trigger.type !== "label_added") continue;

    const existing = await getActiveEnrollment(admin, wf.id, args.contactId);
    if (existing.data) continue; // already mid-flight

    const enrolled = await createEnrollment(admin, {
      workflow_id: wf.id,
      contact_id: args.contactId,
      status: "active",
      current_step: 0,
      next_run_at: new Date().toISOString(),
    });
    if (enrolled.data) {
      await logActivity(admin, {
        contact_id: args.contactId,
        event_type: "workflow_enrolled",
        payload: { workflow_id: wf.id, workflow_name: wf.name, via: "label_added" },
      });
      await runEnrollment(admin, enrolled.data);
    }
  }
}
