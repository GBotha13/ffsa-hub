// ============================================================
// Custom checkout questions — shared model + validation
// ============================================================
// Per-event questions collected from the buyer at ticket checkout.
// Reuses the dynamic-forms field model (src/lib/forms/schema.ts) so a
// checkout question behaves exactly like a CRM lead-capture field —
// same shape, same conditional-visibility, same answer-key resolution.
//
// Schema lives on events.checkout_questions (a flat FormField[] — no
// multi-step wrapper). Answers are validated against it at checkout and
// stored on orders.custom_answers as a self-describing snapshot.
// (Migration 094.)
// ============================================================

import {
  type FormField,
  type FormFieldType,
  fieldKey,
  isFieldVisible,
} from "@/lib/forms/schema";

// The field types exposed in the checkout-question builder — a focused
// subset of FormFieldType. Excludes CRM-form-only concepts (outcome,
// consent) and contact-column mapping; a checkout answer is just data on
// the order, not a contact field.
export const CHECKOUT_QUESTION_TYPES: FormFieldType[] = [
  "text",
  "long_text",
  "email",
  "phone",
  "number",
  "date",
  "dropdown",
  "multiselect",
  "radio",
  "yes_no",
  "checkbox",
];

// A checkout question reuses the FormField shape so the forms renderer,
// conditional-visibility, and key logic apply unchanged.
export type CheckoutQuestion = FormField;

// Stored on orders.custom_answers — a self-describing snapshot so the
// admin view stays correct even if the questions are edited later.
export type CheckoutAnswerSnapshot = {
  id: string;
  label: string;
  value: unknown;
};

export type CheckoutValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

function fieldsMap(questions: FormField[]): Map<string, FormField> {
  const m = new Map<string, FormField>();
  for (const q of questions) m.set(q.id, q);
  return m;
}

function isEmptyAnswer(field: FormField, raw: unknown): boolean {
  return (
    raw == null ||
    raw === "" ||
    (Array.isArray(raw) && raw.length === 0) ||
    (field.type === "checkbox" && raw === false)
  );
}

// Mirrors validateSubmission's per-field checks (required / email /
// number) and conditional-visibility skipping, WITHOUT its forms-only
// "must collect an email or phone" rule (schema.ts) — the buyer's email
// is already captured separately on the order. Keys line up via fieldKey
// across the renderer, this validator, and snapshotAnswers.
export function validateCheckoutAnswers(
  questions: FormField[],
  data: Record<string, unknown>
): CheckoutValidationResult {
  const errors: Record<string, string> = {};
  const byId = fieldsMap(questions);

  for (const field of questions) {
    if (!isFieldVisible(field, byId, data)) continue;
    const k = fieldKey(field);
    const raw = data[k];
    const empty = isEmptyAnswer(field, raw);

    if (field.required && empty) {
      errors[k] = `${field.label} is required`;
      continue;
    }
    if (empty) continue;

    if (field.type === "email" && typeof raw === "string") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
        errors[k] = "Enter a valid email address";
      }
    }
    if (field.type === "number" && typeof raw === "string" && raw.trim() !== "") {
      if (Number.isNaN(Number(raw))) {
        errors[k] = "Enter a number";
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Build the snapshot stored on the order. Only visible, answered
// questions are included; the raw value is preserved (jsonb) and
// formatAnswerValue renders it for display.
export function snapshotAnswers(
  questions: FormField[],
  data: Record<string, unknown>
): CheckoutAnswerSnapshot[] {
  const byId = fieldsMap(questions);
  const out: CheckoutAnswerSnapshot[] = [];
  for (const field of questions) {
    if (!isFieldVisible(field, byId, data)) continue;
    const raw = data[fieldKey(field)];
    if (isEmptyAnswer(field, raw)) continue;
    out.push({ id: field.id, label: field.label, value: raw });
  }
  return out;
}

// Render a stored answer value as a human string for admin / future
// exports.
export function formatAnswerValue(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return value == null ? "" : String(value);
}

// Coerce/validate an incoming questions array (from the admin builder)
// into clean, well-formed FormField objects — drops anything malformed
// so the stored schema is always safe to render and validate against.
export function sanitizeCheckoutQuestions(input: unknown): FormField[] {
  if (!Array.isArray(input)) return [];
  const out: FormField[] = [];
  const seenIds = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = r.type as FormFieldType;
    if (!CHECKOUT_QUESTION_TYPES.includes(type)) continue;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label) continue;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : null;
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    const q: FormField = {
      id,
      type,
      label,
      key: typeof r.key === "string" ? r.key.trim() : "",
      required: r.required === true,
    };
    if (Array.isArray(r.options)) {
      const opts = r.options.filter(
        (o): o is string => typeof o === "string" && o.trim() !== ""
      );
      if (opts.length) q.options = opts;
    }
    if (typeof r.helpText === "string" && r.helpText.trim()) {
      q.helpText = r.helpText.trim();
    }
    if (typeof r.parentFieldId === "string" && r.parentFieldId.trim()) {
      q.parentFieldId = r.parentFieldId.trim();
    }
    if (typeof r.showWhenValue === "string") {
      q.showWhenValue = r.showWhenValue;
    }
    out.push(q);
  }
  return out;
}
