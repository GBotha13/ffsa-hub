"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { type FormField, fieldKey, isFieldVisible } from "@/lib/forms/schema";

// Shared renderer for an event's custom checkout questions, embedded in
// each storefront's buyer section. Brand-agnostic: every storefront keeps
// its own look by passing a `classes` set (the generic storefront leans on
// globals.css; THE SEND / FFSA Camps pass their scoped class names).
//
// Field logic (conditional visibility via isFieldVisible, answer keys via
// fieldKey) is shared with the server validator + snapshot, so the same
// keys line up across render → validate → store.

export type CheckoutFieldClasses = {
  field: string; // wrapper per question
  label: string;
  required: string; // the " *" marker
  input: string; // text / email / tel / number / date
  textarea: string;
  select: string;
  optionRow: string; // label wrapping a radio / checkbox
  optionText: string;
  help: string;
  error: string;
};

export function CheckoutQuestionFields({
  questions,
  values,
  errors,
  onChange,
  classes,
  idPrefix = "cq",
}: {
  questions: FormField[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  classes: CheckoutFieldClasses;
  idPrefix?: string;
}) {
  const byId = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );
  const visible = questions.filter((q) => isFieldVisible(q, byId, values));

  return (
    <>
      {visible.map((q) => {
        const k = fieldKey(q);
        const raw = values[k];
        const str = typeof raw === "string" ? raw : "";
        const err = errors[k];
        const id = `${idPrefix}-${q.id}`;
        const reqMark = q.required ? (
          <span className={classes.required}> *</span>
        ) : null;

        let control: ReactNode = null;
        switch (q.type) {
          case "long_text":
            control = (
              <textarea
                id={id}
                className={classes.textarea}
                value={str}
                rows={3}
                onChange={(e) => onChange(k, e.target.value)}
              />
            );
            break;
          case "dropdown":
            control = (
              <select
                id={id}
                className={classes.select}
                value={str}
                onChange={(e) => onChange(k, e.target.value)}
              >
                <option value="">Select…</option>
                {(q.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            );
            break;
          case "radio":
          case "yes_no": {
            const opts = q.type === "yes_no" ? ["Yes", "No"] : q.options ?? [];
            control = (
              <div className="space-y-1.5 mt-1">
                {opts.map((o) => (
                  <label key={o} className={classes.optionRow}>
                    <input
                      type="radio"
                      name={id}
                      checked={raw === o}
                      onChange={() => onChange(k, o)}
                    />
                    <span className={classes.optionText}>{o}</span>
                  </label>
                ))}
              </div>
            );
            break;
          }
          case "multiselect": {
            const arr = Array.isArray(raw) ? (raw as string[]) : [];
            control = (
              <div className="space-y-1.5 mt-1">
                {(q.options ?? []).map((o) => (
                  <label key={o} className={classes.optionRow}>
                    <input
                      type="checkbox"
                      checked={arr.includes(o)}
                      onChange={(e) =>
                        onChange(
                          k,
                          e.target.checked
                            ? [...arr, o]
                            : arr.filter((x) => x !== o)
                        )
                      }
                    />
                    <span className={classes.optionText}>{o}</span>
                  </label>
                ))}
              </div>
            );
            break;
          }
          case "checkbox":
            // Single checkbox — the label rides inline with the control.
            return (
              <div className={classes.field} key={q.id}>
                <label className={classes.optionRow}>
                  <input
                    type="checkbox"
                    checked={raw === true}
                    onChange={(e) => onChange(k, e.target.checked)}
                  />
                  <span className={classes.optionText}>
                    {q.label}
                    {reqMark}
                  </span>
                </label>
                {q.helpText && <p className={classes.help}>{q.helpText}</p>}
                {err && <p className={classes.error}>{err}</p>}
              </div>
            );
          default: {
            const inputType =
              q.type === "email"
                ? "email"
                : q.type === "phone"
                  ? "tel"
                  : q.type === "number"
                    ? "number"
                    : q.type === "date"
                      ? "date"
                      : "text";
            control = (
              <input
                id={id}
                type={inputType}
                className={classes.input}
                value={str}
                onChange={(e) => onChange(k, e.target.value)}
              />
            );
          }
        }

        return (
          <div className={classes.field} key={q.id}>
            <label htmlFor={id} className={classes.label}>
              {q.label}
              {reqMark}
            </label>
            {control}
            {q.helpText && <p className={classes.help}>{q.helpText}</p>}
            {err && <p className={classes.error}>{err}</p>}
          </div>
        );
      })}
    </>
  );
}
