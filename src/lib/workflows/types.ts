// ============================================================
// Workflow shared types + trigger evaluation
// ============================================================
// Used by the form-submit enrollment hook, the runner, and the
// admin builder UI so the jsonb shapes stay in one place.
// ============================================================

import type { CampaignBody } from "@/lib/campaigns/blocks";

// ── Trigger ──────────────────────────────────────────────────
// Stored in outcome_workflows.trigger (jsonb).
export type WorkflowTrigger =
  | { type: "on_submit" }
  | {
      type: "answer";
      field_key: string; // matches the form field's data key (fieldKey())
      op: "eq";
      value: string | boolean;
    }
  // Fires when the outcome's label is added to a contact by ANY means
  // (manual, CSV import, another workflow). Evaluated by the label-add
  // path, NOT by the form-submit hook — so evaluateTrigger() returns false.
  | { type: "label_added"; label_id: string };

// ── Steps ────────────────────────────────────────────────────
// Stored in workflow_steps.step_type + workflow_steps.config (jsonb).
export type WorkflowStepType = "send_email" | "delay" | "assign_label";

export type SendEmailConfig = {
  subject: string;
  body: CampaignBody; // same composer format as campaigns
  sending_identity_id?: string | null; // falls back to the outcome label's identity
};

export type DelayConfig = {
  days: number;
};

export type AssignLabelConfig = {
  label_id: string;
};

export type WorkflowStepConfig = SendEmailConfig | DelayConfig | AssignLabelConfig;

// "Instant" steps execute back-to-back in a single runner tick;
// a delay step is the only one that parks the enrollment.
export function isInstantStep(stepType: WorkflowStepType): boolean {
  return stepType === "send_email" || stepType === "assign_label";
}

// ── Trigger evaluation ───────────────────────────────────────
// `data` is the raw form submission keyed by fieldKey().
export function evaluateTrigger(
  trigger: WorkflowTrigger | null | undefined,
  data: Record<string, unknown>
): boolean {
  if (!trigger || trigger.type === "on_submit") return true;
  if (trigger.type === "answer") {
    const actual = data[trigger.field_key];
    if (typeof trigger.value === "boolean") {
      return Boolean(actual) === trigger.value;
    }
    const want = String(trigger.value).trim().toLowerCase();
    // Outcome / commitment checkboxes submit a boolean. Map truthy / falsy
    // words onto the checkbox state so a trigger like "answer = Yes" matches a
    // ticked box (actual === true), and "= No" matches an unticked one.
    if (typeof actual === "boolean") {
      const truthy = ["yes", "y", "true", "checked", "on", "1"];
      const falsy = ["no", "n", "false", "unchecked", "off", "0"];
      if (truthy.includes(want)) return actual === true;
      if (falsy.includes(want)) return actual === false;
      return false;
    }
    // Text answers (radio / dropdown): case-insensitive, trimmed compare.
    return String(actual ?? "").trim().toLowerCase() === want;
  }
  // label_added triggers are not driven by form submissions.
  return false;
}
