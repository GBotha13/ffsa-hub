"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  type FormField,
  type FormFieldType,
  newLocalId,
  isParentEligible,
  isBooleanParentType,
  parentValueChoices,
} from "@/lib/forms/schema";
import { CHECKOUT_QUESTION_TYPES } from "@/lib/ticketing/checkout-questions";

// Admin builder for an event's custom checkout questions. Adapted from
// the CRM form-builder's FieldEditor, trimmed to ticketing needs: no
// contact-field mapping, no outcome/consent types. Questions are a flat
// list (asked once per order, after the buyer's contact details).

const TYPE_LABELS: Partial<Record<FormFieldType, string>> = {
  text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  date: "Date",
  number: "Number",
  yes_no: "Yes / No",
  dropdown: "Dropdown",
  multiselect: "Multi-select",
  radio: "Radio buttons",
  checkbox: "Checkbox",
};

const FIELD_TYPES = CHECKOUT_QUESTION_TYPES.map((value) => ({
  value,
  label: TYPE_LABELS[value] ?? value,
}));

const CHOICE_TYPES: FormFieldType[] = ["dropdown", "multiselect", "radio"];

function questionDepth(
  id: string,
  byId: Map<string, FormField>
): number {
  let depth = 0;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parentFieldId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentFieldId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

export function CheckoutQuestionsManager({
  eventId,
  initialQuestions,
}: {
  eventId: string;
  initialQuestions: FormField[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<FormField[]>(initialQuestions);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(questions) !== JSON.stringify(initialQuestions),
    [questions, initialQuestions]
  );

  const byId = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  function addQuestion() {
    setMsg(null);
    setQuestions((qs) => [
      ...qs,
      {
        id: newLocalId("q"),
        type: "text",
        label: "New question",
        key: "",
        required: false,
      },
    ]);
  }

  function updateQuestion(id: string, patch: Partial<FormField>) {
    setMsg(null);
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function removeQuestion(id: string) {
    setMsg(null);
    // Clear any conditional rule that referenced the removed question so
    // its children become unconditional rather than permanently hidden.
    setQuestions((qs) =>
      qs
        .filter((q) => q.id !== id)
        .map((q) =>
          q.parentFieldId === id
            ? { ...q, parentFieldId: null, showWhenValue: null }
            : q
        )
    );
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    setMsg(null);
    setQuestions((qs) => {
      const next = [...qs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/events/${eventId}/checkout-questions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout_questions: questions }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Couldn't save questions. Please try again.");
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checkout questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Extra questions asked once per order at checkout, after the buyer&apos;s
          name and email. Use these to collect what this event needs — group or
          church, dietary requirements, emergency contact, etc. Leave empty to
          collect nothing extra.
        </p>

        {questions.length === 0 && (
          <p className="text-xs italic text-muted-foreground">
            No custom questions yet — buyers just provide name, email, and phone.
          </p>
        )}

        {questions.map((q, idx) => {
          const eligibleParents = questions.filter(
            (p, i) => i < idx && isParentEligible(p) && p.id !== q.id
          );
          return (
            <QuestionEditor
              key={q.id}
              field={q}
              eligibleParents={eligibleParents}
              depth={questionDepth(q.id, byId)}
              onChange={(patch) => updateQuestion(q.id, patch)}
              onRemove={() => removeQuestion(q.id)}
              onMoveUp={() => moveQuestion(idx, -1)}
              onMoveDown={() => moveQuestion(idx, 1)}
              canMoveUp={idx > 0}
              canMoveDown={idx < questions.length - 1}
            />
          );
        })}

        <button
          type="button"
          onClick={addQuestion}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add question
        </button>

        {err && <p className="text-xs text-red-600">{err}</p>}
        {msg && !dirty && <p className="text-xs text-green-600">{msg}</p>}

        {dirty && (
          <div className="flex items-center gap-2 border-t pt-3">
            <Button onClick={save} disabled={busy} size="sm">
              {busy ? "Saving…" : "Save questions"}
            </Button>
            <Button
              onClick={() => {
                setQuestions(initialQuestions);
                setErr(null);
                setMsg(null);
              }}
              disabled={busy}
              size="sm"
              variant="outline"
            >
              Discard
            </Button>
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Local-state textarea for choice options — mirrors the form-builder's
// OptionsEditor so Enter adds a line without the cleaned array snapping
// the cursor back.
function OptionsEditor({
  options,
  onChange,
}: {
  options: string[] | undefined;
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState<string>(() => (options ?? []).join("\n"));

  useEffect(() => {
    const fromProps = (options ?? []).join("\n");
    const normalised = text
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean)
      .join("\n");
    if (fromProps !== normalised) setText(fromProps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return (
    <textarea
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onChange(next.split("\n").map((o) => o.trim()).filter(Boolean));
      }}
      rows={3}
      className="w-full border rounded px-2 py-1 text-xs mt-1 resize-none"
    />
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
        danger ? "text-red-600 hover:bg-destructive/10" : "hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}

function QuestionEditor({
  field,
  eligibleParents,
  depth,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  field: FormField;
  eligibleParents: FormField[];
  depth: number;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const isChoice = CHOICE_TYPES.includes(field.type);
  const parent = field.parentFieldId
    ? eligibleParents.find((p) => p.id === field.parentFieldId)
    : undefined;
  const parentValues = parent ? parentValueChoices(parent) : [];
  const orphanedParentRef = field.parentFieldId != null && !parent;

  return (
    <div
      className="border rounded p-3 space-y-2 bg-muted/40"
      style={depth > 0 ? { marginLeft: depth * 16 } : undefined}
    >
      {depth > 0 && (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground -mt-1 mb-1">
          ↳ conditional follow-up
        </p>
      )}
      <div className="flex items-center gap-2">
        <select
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FormFieldType;
            const patch: Partial<FormField> = { type };
            if (CHOICE_TYPES.includes(type) && !field.options)
              patch.options = ["Option 1"];
            if (type === "yes_no") patch.options = ["Yes", "No"];
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
          placeholder="Question label"
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <IconBtn onClick={onMoveUp} disabled={!canMoveUp} label="↑" />
        <IconBtn onClick={onMoveDown} disabled={!canMoveDown} label="↓" />
        <IconBtn onClick={onRemove} label="✕" danger />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Required
        </label>
      </div>

      {isChoice && (
        <div className="text-xs">
          <span className="text-muted-foreground">Options (one per line)</span>
          <OptionsEditor
            options={field.options}
            onChange={(options) => onChange({ options })}
          />
        </div>
      )}

      {/* Conditional visibility — show this question only when an earlier
          choice question has a particular answer. */}
      <div className="text-xs border-t pt-2 mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">Show only when</span>
          <select
            value={field.parentFieldId ?? ""}
            onChange={(e) => {
              const nextId = e.target.value || null;
              const nextParent = nextId
                ? eligibleParents.find((p) => p.id === nextId)
                : undefined;
              const choices = nextParent ? parentValueChoices(nextParent) : [];
              onChange({
                parentFieldId: nextId,
                showWhenValue: nextId ? choices[0] ?? null : null,
              });
            }}
            className="border rounded px-1.5 py-0.5 text-xs max-w-[14rem]"
          >
            <option value="">— always show —</option>
            {eligibleParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || "(untitled)"}
              </option>
            ))}
          </select>
          {parent && parentValues.length > 0 && (
            <>
              <span className="text-muted-foreground">is</span>
              <select
                value={field.showWhenValue ?? ""}
                onChange={(e) => onChange({ showWhenValue: e.target.value || null })}
                className="border rounded px-1.5 py-0.5 text-xs"
              >
                {isBooleanParentType(parent.type) ? (
                  <option value="true">Checked</option>
                ) : (
                  parentValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))
                )}
              </select>
            </>
          )}
        </div>
        {orphanedParentRef && (
          <p className="text-amber-600 mt-1">
            The parent question for this rule no longer exists — pick another or
            clear the rule.
          </p>
        )}
      </div>
    </div>
  );
}
