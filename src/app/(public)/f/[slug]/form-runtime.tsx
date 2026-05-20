"use client";

import { useMemo, useState } from "react";
import { type FormSchema, type FormField, fieldKey } from "@/lib/forms/schema";

type Values = Record<string, unknown>;

export function FormRuntime({
  slug,
  schema,
  formName,
}: {
  slug: string;
  schema: FormSchema;
  formName: string;
}) {
  const accent = schema.branding.accentColor || "#1e40af";
  const steps = schema.steps;
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const progress = useMemo(
    () => Math.round(((stepIdx + 1) / Math.max(steps.length, 1)) * 100),
    [stepIdx, steps.length]
  );

  function setValue(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateStep(): boolean {
    const step = steps[stepIdx];
    const stepErrors: Record<string, string> = {};
    for (const field of step.fields) {
      const k = fieldKey(field);
      const raw = values[k];
      const empty =
        raw == null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0) ||
        ((field.type === "checkbox" || field.type === "consent") && raw !== true);
      if (field.required && empty) {
        stepErrors[k] = `${field.label} is required`;
        continue;
      }
      if (!empty && field.type === "email" && typeof raw === "string") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
          stepErrors[k] = "Enter a valid email address";
        }
      }
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }

  function next() {
    if (!validateStep()) return;
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }
  function prev() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/f/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: values }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (data.fieldErrors) setErrors(data.fieldErrors);
      setSubmitError(data.error ?? "Submission failed. Please try again.");
      return;
    }
    const result = (await res.json()) as { redirectUrl?: string | null };
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    setDone(true);
  }

  const isLastStep = stepIdx === steps.length - 1;
  const step = steps[stepIdx];

  // The app's globals.css themes all inputs dark via CSS variables with
  // !important. Redefining those variables to light values here makes the
  // !important rules resolve light — no specificity fight needed.
  const lightTheme = {
    backgroundColor: "#f3f4f6",
    colorScheme: "light",
    "--surface-1": "#ffffff",
    "--surface-2": "#f9fafb",
    "--surface-3": "#f3f4f6",
    "--surface-4": "#d1d5db",
    "--text-primary": "#111827",
    "--text-secondary": "#4b5563",
    "--text-tertiary": "#6b7280",
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen flex items-start justify-center p-4 sm:p-8"
      style={lightTheme}
    >
      <div
        className="w-full max-w-xl rounded-xl shadow-sm border overflow-hidden"
        style={{ backgroundColor: "#ffffff", color: "#111827" }}
      >
        <div className="p-6 sm:p-8">
          {/* Branding */}
          {schema.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={schema.branding.logoUrl}
              alt=""
              className="h-10 mb-6 object-contain"
            />
          ) : (
            <p className="text-sm font-semibold mb-6" style={{ color: "#374151" }}>
              {formName}
            </p>
          )}

          {done ? (
            <div className="py-10 text-center">
              <h1 className="text-xl font-bold" style={{ color: "#111827" }}>
                {schema.thankYou.heading}
              </h1>
              <p className="text-sm mt-2" style={{ color: "#4b5563" }}>
                {schema.thankYou.message}
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold mb-1" style={{ color: "#111827" }}>
                {step.title}
              </h1>

              {/* Progress */}
              <div className="flex items-center gap-2 my-4">
                <span className="text-xs text-gray-500 w-9">{progress}%</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, backgroundColor: accent }}
                  />
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                {step.fields.map((field) => (
                  <FieldInput
                    key={field.id}
                    field={field}
                    value={values[fieldKey(field)]}
                    error={errors[fieldKey(field)]}
                    accent={accent}
                    onChange={(v) => setValue(fieldKey(field), v)}
                  />
                ))}
              </div>

              {submitError && (
                <p className="text-sm text-red-600 mt-4">{submitError}</p>
              )}

              {/* Nav */}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={prev}
                  disabled={stepIdx === 0 || submitting}
                  className="px-4 py-2 rounded text-sm border disabled:opacity-40"
                  style={{ borderColor: "#d1d5db", color: "#374151" }}
                >
                  Previous
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="px-5 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={next}
                    disabled={submitting}
                    className="px-5 py-2 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: accent }}
                  >
                    Next
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  accent,
  onChange,
}: {
  field: FormField;
  value: unknown;
  error?: string;
  accent: string;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label
      className="block text-sm font-medium mb-1"
      style={{ color: "#1f2937" }}
    >
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  );
  const inputCls = `w-full border rounded px-3 py-2 text-sm ${
    error ? "border-red-400" : "border-gray-300"
  }`;
  const inputStyle = { backgroundColor: "#ffffff", color: "#111827" } as const;
  const str = typeof value === "string" ? value : "";

  let control: React.ReactNode = null;

  if (
    field.type === "text" ||
    field.type === "email" ||
    field.type === "phone" ||
    field.type === "number" ||
    field.type === "date"
  ) {
    const htmlType =
      field.type === "email"
        ? "email"
        : field.type === "phone"
        ? "tel"
        : field.type === "number"
        ? "number"
        : field.type === "date"
        ? "date"
        : "text";
    control = (
      <input
        type={htmlType}
        value={str}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        style={inputStyle}
      />
    );
  } else if (field.type === "long_text") {
    control = (
      <textarea
        value={str}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={`${inputCls} resize-none`}
        style={inputStyle}
      />
    );
  } else if (field.type === "dropdown") {
    control = (
      <select
        value={str}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        style={inputStyle}
      >
        <option value="">— select —</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "radio") {
    control = (
      <div className="space-y-1">
        {(field.options ?? []).map((o) => (
          <label
            key={o}
            className="flex items-center gap-2 text-sm"
            style={{ color: "#1f2937" }}
          >
            <input
              type="radio"
              name={field.id}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            {o}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "multiselect") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    control = (
      <div className="space-y-1">
        {(field.options ?? []).map((o) => (
          <label
            key={o}
            className="flex items-center gap-2 text-sm"
            style={{ color: "#1f2937" }}
          >
            <input
              type="checkbox"
              checked={arr.includes(o)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...arr, o] : arr.filter((x) => x !== o)
                )
              }
            />
            {o}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "checkbox" || field.type === "consent" || field.type === "outcome") {
    return (
      <div>
        <label
          className={`flex items-start gap-2 text-sm ${
            field.type === "outcome" ? "p-3 rounded border" : ""
          }`}
          style={
            field.type === "outcome"
              ? { borderColor: accent, backgroundColor: `${accent}10`, color: "#1f2937" }
              : { color: "#1f2937" }
          }
        >
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </span>
        </label>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {label}
      {control}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
