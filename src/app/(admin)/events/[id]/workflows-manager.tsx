"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowDown, ArrowUp, Mail, Clock, Tag, Plus, Trash2, Pencil } from "lucide-react";
import { EmailBlockComposer } from "@/components/communications/email-block-composer";
import type { CampaignBody } from "@/lib/campaigns/blocks";
import type {
  WorkflowTrigger,
  WorkflowStepType,
  WorkflowSchedulerConfig,
} from "@/lib/workflows/types";

type TriggerField = { key: string; label: string };
type StepDraft = { step_type: WorkflowStepType; config: Record<string, unknown> };
type WorkflowRow = {
  id: string;
  name: string;
  trigger: WorkflowTrigger | null;
  is_active: boolean;
  workflow_steps: Array<{
    id: string;
    sort_order: number;
    step_type: string;
    config: Record<string, unknown>;
  }>;
};

type Draft = {
  id?: string;
  name: string;
  trigger: WorkflowTrigger;
  is_active: boolean;
  steps: StepDraft[];
};

type Props = {
  eventId: string;
  outcomeId: string;
  outcomeName: string;
  outcomeLabelId: string | null;
  hasForm: boolean;
  labelOptions: Array<{ id: string; name: string }>;
  identityOptions: Array<{ id: string; label: string }>;
  triggerFields: TriggerField[];
  initialWorkflows: WorkflowRow[];
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm w-full";

function emptyDraft(): Draft {
  return {
    name: "",
    trigger: { type: "on_submit" },
    is_active: true,
    steps: [],
  };
}

function rowToDraft(w: WorkflowRow): Draft {
  return {
    id: w.id,
    name: w.name,
    trigger: w.trigger ?? { type: "on_submit" },
    is_active: w.is_active,
    steps: [...w.workflow_steps]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ step_type: s.step_type as WorkflowStepType, config: s.config ?? {} })),
  };
}

export function WorkflowsManager({
  eventId,
  outcomeId,
  outcomeName,
  outcomeLabelId,
  hasForm,
  labelOptions,
  identityOptions,
  triggerFields,
  initialWorkflows,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const base = `/api/events/${eventId}/outcomes/${outcomeId}/workflows`;

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the workflow a name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        trigger: draft.trigger,
        is_active: draft.is_active,
        steps: draft.steps,
      };
      const res = await fetch(draft.id ? `${base}/${draft.id}` : base, {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      toast.success(draft.id ? "Workflow updated" : "Workflow created");
      setDraft(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this workflow? Active enrollments stop running.")) return;
    const res = await fetch(`${base}/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Workflow deleted");
      router.refresh();
    } else {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Workflows</p>
        <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New workflow
        </Button>
      </div>

      {initialWorkflows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workflows yet. A workflow sends an automated sequence when someone
          responds to this outcome.
        </p>
      ) : (
        <div className="space-y-2">
          {initialWorkflows.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{w.name}</span>
                  {!w.is_active && (
                    <Badge variant="outline" className="text-xs">
                      Paused
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {triggerSummary(w.trigger, triggerFields)} ·{" "}
                  {w.workflow_steps.length} step
                  {w.workflow_steps.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDraft(rowToDraft(w))}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(w.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {draft?.id ? "Edit workflow" : "New workflow"} · {outcomeName}
            </SheetTitle>
          </SheetHeader>

          {draft && (
            <div className="space-y-5 px-4 pb-8">
              <Field label="Name">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Bible study nurture"
                />
              </Field>

              <TriggerEditor
                trigger={draft.trigger}
                onChange={(trigger) => setDraft({ ...draft, trigger })}
                triggerFields={triggerFields}
                outcomeLabelId={outcomeLabelId}
                hasForm={hasForm}
              />

              <StepsEditor
                steps={draft.steps}
                onChange={(steps) => setDraft({ ...draft, steps })}
                labelOptions={labelOptions}
                identityOptions={identityOptions}
              />

              <label className="flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) =>
                    setDraft({ ...draft, is_active: e.target.checked })
                  }
                  className="rounded"
                />
                Active (enrolls new responders)
              </label>

              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : draft.id ? "Save changes" : "Create workflow"}
                </Button>
                <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Trigger editor ───────────────────────────────────────────

function TriggerEditor({
  trigger,
  onChange,
  triggerFields,
  outcomeLabelId,
  hasForm,
}: {
  trigger: WorkflowTrigger;
  onChange: (t: WorkflowTrigger) => void;
  triggerFields: TriggerField[];
  outcomeLabelId: string | null;
  hasForm: boolean;
}) {
  return (
    <Field label="Trigger — when does someone enter this workflow?">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={trigger.type === "on_submit"}
            onChange={() => onChange({ type: "on_submit" })}
            disabled={!hasForm}
          />
          When the outcome&apos;s form is submitted
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={trigger.type === "answer"}
            onChange={() =>
              onChange({
                type: "answer",
                field_key: triggerFields[0]?.key ?? "",
                op: "eq",
                value: "Yes",
              })
            }
            disabled={!hasForm || triggerFields.length === 0}
          />
          When an answer matches a value
        </label>
        {trigger.type === "answer" && (
          <div className="ml-6 flex flex-wrap items-center gap-2">
            <select
              className={`${selectClass} max-w-[220px]`}
              value={trigger.field_key}
              onChange={(e) => onChange({ ...trigger, field_key: e.target.value })}
            >
              {triggerFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">equals</span>
            <Input
              value={String(trigger.value)}
              onChange={(e) => onChange({ ...trigger, value: e.target.value })}
              placeholder="Yes"
              className="max-w-[160px]"
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={trigger.type === "label_added"}
            onChange={() =>
              onChange({ type: "label_added", label_id: outcomeLabelId ?? "" } as WorkflowTrigger)
            }
            disabled={!outcomeLabelId}
          />
          When this outcome&apos;s label is added to a contact
          {!outcomeLabelId && (
            <span className="text-xs text-muted-foreground">
              (set a label on the outcome first)
            </span>
          )}
        </label>
      </div>
    </Field>
  );
}

// ── Steps editor ─────────────────────────────────────────────

function StepsEditor({
  steps,
  onChange,
  labelOptions,
  identityOptions,
}: {
  steps: StepDraft[];
  onChange: (s: StepDraft[]) => void;
  labelOptions: Array<{ id: string; name: string }>;
  identityOptions: Array<{ id: string; label: string }>;
}) {
  const add = (step_type: WorkflowStepType) => {
    const config: Record<string, unknown> =
      step_type === "send_email"
        ? { subject: "", body: { version: 1, blocks: [] } }
        : step_type === "delay"
          ? { days: 14 }
          : { label_id: labelOptions[0]?.id ?? "" };
    onChange([...steps, { step_type, config }]);
  };
  const patch = (i: number, config: Record<string, unknown>) =>
    onChange(steps.map((s, idx) => (idx === i ? { ...s, config } : s)));
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <Field label="Steps — run top to bottom">
      <div className="space-y-3">
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No steps yet. Add an email, a delay, or a label.
          </p>
        )}
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <StepIcon type={step.step_type} />
                {stepTitle(step.step_type)}
              </div>
              <div className="flex gap-1">
                <MiniBtn onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </MiniBtn>
                <MiniBtn onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </MiniBtn>
                <MiniBtn onClick={() => remove(i)} danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </MiniBtn>
              </div>
            </div>

            {step.step_type === "send_email" && (
              <div className="space-y-2">
                <Input
                  value={(step.config.subject as string) ?? ""}
                  onChange={(e) => patch(i, { ...step.config, subject: e.target.value })}
                  placeholder="Email subject"
                />
                {identityOptions.length > 0 && (
                  <select
                    className={selectClass}
                    value={(step.config.sending_identity_id as string) ?? ""}
                    onChange={(e) =>
                      patch(i, {
                        ...step.config,
                        sending_identity_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Default sender (outcome label&apos;s identity)</option>
                    {identityOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                <EmailBlockComposer
                  value={(step.config.body as CampaignBody) ?? { version: 1, blocks: [] }}
                  onChange={(body) => patch(i, { ...step.config, body })}
                />
                <SchedulerToggle
                  scheduler={step.config.scheduler as WorkflowSchedulerConfig | undefined}
                  onChange={(scheduler) => patch(i, { ...step.config, scheduler })}
                />
              </div>
            )}

            {step.step_type === "delay" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Wait</span>
                <Input
                  type="number"
                  min={0}
                  value={String((step.config.days as number) ?? 0)}
                  onChange={(e) =>
                    patch(i, { ...step.config, days: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            )}

            {step.step_type === "assign_label" && (
              <select
                className={selectClass}
                value={(step.config.label_id as string) ?? ""}
                onChange={(e) => patch(i, { ...step.config, label_id: e.target.value })}
              >
                <option value="">Select a label…</option>
                {labelOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => add("send_email")}>
            <Mail className="h-3.5 w-3.5 mr-1" /> Email
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => add("delay")}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Delay
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => add("assign_label")}>
            <Tag className="h-3.5 w-3.5 mr-1" /> Assign label
          </Button>
        </div>
      </div>
    </Field>
  );
}

// ── small helpers ────────────────────────────────────────────

function SchedulerToggle({
  scheduler,
  onChange,
}: {
  scheduler: WorkflowSchedulerConfig | undefined;
  onChange: (s: WorkflowSchedulerConfig) => void;
}) {
  const enabled = !!scheduler?.enabled;
  const base: WorkflowSchedulerConfig = scheduler ?? { enabled: true };
  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange({ ...base, enabled: e.target.checked })
          }
        />
        📅 Ask for their availability — adds a “pick a time” button
      </label>
      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2 pl-6">
            <label className="text-xs text-muted-foreground space-y-1 block">
              <span>Call length (min)</span>
              <Input
                type="number"
                min={5}
                value={String(scheduler?.durationMinutes ?? 30)}
                onChange={(e) =>
                  onChange({ ...base, durationMinutes: Math.max(5, Number(e.target.value)) })
                }
              />
            </label>
            <label className="text-xs text-muted-foreground space-y-1 block">
              <span>Booking window (days)</span>
              <Input
                type="number"
                min={1}
                value={String(scheduler?.windowDays ?? 14)}
                onChange={(e) =>
                  onChange({ ...base, windowDays: Math.max(1, Number(e.target.value)) })
                }
              />
            </label>
            <label className="text-xs text-muted-foreground space-y-1 block col-span-2">
              <span>Button label</span>
              <Input
                value={scheduler?.buttonText ?? "Choose a time that works"}
                onChange={(e) => onChange({ ...base, buttonText: e.target.value })}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            The recipient picks times on a Calendly-style page; their choices land
            on the contact&apos;s Event Follow-up profile.
          </p>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function MiniBtn({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? "hover:text-red-600" : ""
      }`}
    >
      {children}
    </button>
  );
}

function StepIcon({ type }: { type: WorkflowStepType }) {
  if (type === "send_email") return <Mail className="h-4 w-4" />;
  if (type === "delay") return <Clock className="h-4 w-4" />;
  return <Tag className="h-4 w-4" />;
}

function stepTitle(type: WorkflowStepType): string {
  if (type === "send_email") return "Send email";
  if (type === "delay") return "Delay";
  return "Assign label";
}

function triggerSummary(
  trigger: WorkflowTrigger | null,
  fields: TriggerField[]
): string {
  if (!trigger || trigger.type === "on_submit") return "On form submit";
  if (trigger.type === "answer") {
    const label = fields.find((f) => f.key === trigger.field_key)?.label ?? trigger.field_key;
    return `When ${label} = ${trigger.value}`;
  }
  if (trigger.type === "label_added") return "When label added";
  return "Trigger";
}
