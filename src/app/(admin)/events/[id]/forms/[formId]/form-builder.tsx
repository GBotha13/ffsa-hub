"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type FormSchema,
  type FormStep,
  type FormField,
  type FormFieldType,
  CONTACT_FIELD_KEYS,
  newLocalId,
} from "@/lib/forms/schema";
import { QrPanel } from "./qr-panel";

type Outcome = { id: string; name: string };
type Label = { id: string; slug: string; name: string; color: string | null };

type FormMeta = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  records_attendance: boolean;
  label_id: string | null;
};

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
  { value: "radio", label: "Radio buttons" },
  { value: "checkbox", label: "Checkbox" },
  { value: "outcome", label: "Outcome response" },
  { value: "consent", label: "Consent (POPIA)" },
];

const CHOICE_TYPES: FormFieldType[] = ["dropdown", "multiselect", "radio"];

export function FormBuilder({
  eventId,
  form,
  initialSchema,
  outcomes,
  labels,
}: {
  eventId: string;
  form: FormMeta;
  initialSchema: FormSchema;
  outcomes: Outcome[];
  labels: Label[];
}) {
  const router = useRouter();
  const [name, setName] = useState(form.name);
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [labelId, setLabelId] = useState(form.label_id ?? "");
  const [recordsAttendance, setRecordsAttendance] = useState(form.records_attendance);
  const [isActive, setIsActive] = useState(form.is_active);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── schema mutation helpers ───────────────────────────────
  function update(next: Partial<FormSchema>) {
    setSchema((s) => ({ ...s, ...next }));
  }
  function updateStep(stepId: string, patch: Partial<FormStep>) {
    update({
      steps: schema.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    });
  }
  function updateField(stepId: string, fieldId: string, patch: Partial<FormField>) {
    update({
      steps: schema.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.id === fieldId ? { ...f, ...patch } : f
              ),
            }
          : s
      ),
    });
  }
  function addStep() {
    update({
      steps: [
        ...schema.steps,
        { id: newLocalId("step"), title: `Step ${schema.steps.length + 1}`, fields: [] },
      ],
    });
  }
  function removeStep(stepId: string) {
    update({ steps: schema.steps.filter((s) => s.id !== stepId) });
  }
  function moveStep(idx: number, dir: -1 | 1) {
    const next = [...schema.steps];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    update({ steps: next });
  }
  function addField(stepId: string) {
    const f: FormField = {
      id: newLocalId("field"),
      type: "text",
      label: "New field",
      key: "",
      required: false,
    };
    update({
      steps: schema.steps.map((s) =>
        s.id === stepId ? { ...s, fields: [...s.fields, f] } : s
      ),
    });
  }
  function removeField(stepId: string, fieldId: string) {
    update({
      steps: schema.steps.map((s) =>
        s.id === stepId
          ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
          : s
      ),
    });
  }
  function moveField(stepId: string, idx: number, dir: -1 | 1) {
    const step = schema.steps.find((s) => s.id === stepId);
    if (!step) return;
    const next = [...step.fields];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    updateStep(stepId, { fields: next });
  }

  // ── save ──────────────────────────────────────────────────
  async function save(publish?: boolean) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const nextActive = publish === undefined ? isActive : publish;
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        schema,
        label_id: labelId || null,
        records_attendance: recordsAttendance,
        is_active: nextActive,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to save");
      return;
    }
    setIsActive(nextActive);
    setMsg(publish === true ? "Published" : publish === false ? "Unpublished" : "Saved");
    router.refresh();
  }

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 outline-none w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Public URL: <span className="font-mono">{publicUrl}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
            }`}
          >
            {isActive ? "Published" : "Draft"}
          </span>
          <button
            type="button"
            onClick={() => save()}
            disabled={busy}
            className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Save
          </button>
          {isActive ? (
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy}
              className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Save &amp; Publish
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Base label</span>
            <select
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">— none —</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={recordsAttendance}
              onChange={(e) => setRecordsAttendance(e.target.checked)}
            />
            Submitting records event attendance
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Accent color</span>
            <input
              type="color"
              value={schema.branding.accentColor ?? "#1e40af"}
              onChange={(e) =>
                update({ branding: { ...schema.branding, accentColor: e.target.value } })
              }
              className="h-9 w-16 border rounded"
            />
          </label>
        </CardContent>
      </Card>

      {/* QR code */}
      <QrPanel url={publicUrl} formName={name} />

      {/* Steps */}
      {schema.steps.map((step, sIdx) => (
        <Card key={step.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-muted-foreground">Step {sIdx + 1}</span>
              <input
                value={step.title}
                onChange={(e) => updateStep(step.id, { title: e.target.value })}
                className="text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 outline-none flex-1"
              />
            </div>
            <div className="flex gap-1">
              <IconBtn onClick={() => moveStep(sIdx, -1)} disabled={sIdx === 0} label="↑" />
              <IconBtn
                onClick={() => moveStep(sIdx, 1)}
                disabled={sIdx === schema.steps.length - 1}
                label="↓"
              />
              <IconBtn
                onClick={() => removeStep(step.id)}
                disabled={schema.steps.length === 1}
                label="✕"
                danger
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {step.fields.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No fields in this step.</p>
            )}
            {step.fields.map((field, fIdx) => (
              <FieldEditor
                key={field.id}
                field={field}
                outcomes={outcomes}
                onChange={(patch) => updateField(step.id, field.id, patch)}
                onRemove={() => removeField(step.id, field.id)}
                onMoveUp={() => moveField(step.id, fIdx, -1)}
                onMoveDown={() => moveField(step.id, fIdx, 1)}
                canMoveUp={fIdx > 0}
                canMoveDown={fIdx < step.fields.length - 1}
              />
            ))}
            <button
              type="button"
              onClick={() => addField(step.id)}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add field
            </button>
          </CardContent>
        </Card>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="w-full border-2 border-dashed rounded-lg py-3 text-sm text-muted-foreground hover:bg-gray-50"
      >
        + Add step
      </button>
    </div>
  );
}

function IconBtn({
  onClick,
  disabled,
  label,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-6 h-6 text-xs rounded border disabled:opacity-30 ${
        danger ? "text-red-600 hover:bg-red-50" : "hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function FieldEditor({
  field,
  outcomes,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  field: FormField;
  outcomes: Outcome[];
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const isChoice = CHOICE_TYPES.includes(field.type);
  const isOutcome = field.type === "outcome";
  const isConsent = field.type === "consent";

  return (
    <div className="border rounded p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center gap-2">
        <select
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FormFieldType;
            const patch: Partial<FormField> = { type };
            if (CHOICE_TYPES.includes(type) && !field.options) patch.options = ["Option 1"];
            onChange(patch);
          }}
          className="border rounded px-2 py-1 text-xs"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <IconBtn onClick={onMoveUp} disabled={!canMoveUp} label="↑" />
        <IconBtn onClick={onMoveDown} disabled={!canMoveDown} label="↓" />
        <IconBtn onClick={onRemove} label="✕" danger />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {!isOutcome && !isConsent && (
          <label className="text-xs flex items-center gap-1">
            Maps to
            <select
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value })}
              className="border rounded px-1.5 py-0.5 text-xs"
            >
              <option value="">Custom (raw data only)</option>
              {CONTACT_FIELD_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Required
        </label>
      </div>

      {isOutcome && (
        <div className="text-xs">
          {outcomes.length === 0 ? (
            <p className="text-amber-600">
              No outcomes on this event yet — add one on the Details tab first.
            </p>
          ) : (
            <label className="flex items-center gap-1">
              Responds to outcome
              <select
                value={field.outcomeId ?? ""}
                onChange={(e) => onChange({ outcomeId: e.target.value || null })}
                className="border rounded px-1.5 py-0.5 text-xs"
              >
                <option value="">— pick an outcome —</option>
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {isChoice && (
        <div className="text-xs">
          <span className="text-muted-foreground">Options (one per line)</span>
          <textarea
            value={(field.options ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean),
              })
            }
            rows={3}
            className="w-full border rounded px-2 py-1 text-xs mt-1 resize-none"
          />
        </div>
      )}
    </div>
  );
}
