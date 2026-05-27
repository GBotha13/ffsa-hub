"use client";

import { useMemo, useState } from "react";
import { type FormSchema, type FormField, fieldKey } from "@/lib/forms/schema";
import { DateInput } from "@/components/ui/date-input";

type Values = Record<string, unknown>;

export function FormRuntime({
  slug,
  schema,
  formName,
  eventLogoUrl,
}: {
  slug: string;
  schema: FormSchema;
  formName: string;
  eventLogoUrl?: string | null;
}) {
  const accent = schema.branding.accentColor || "#1d4ed8";
  // Event logo (set per event) takes precedence over any form-level logo.
  const logoUrl = eventLogoUrl || schema.branding.logoUrl || null;
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

  // Scoped style block: out-specifies the app's global !important input
  // rules so the public form renders with its own refined light styling.
  const scopedCss = `
.ffsa-pf input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
.ffsa-pf textarea,
.ffsa-pf select {
  background:#ffffff !important;
  color:#0f172a !important;
  border:1px solid #e2e8f0 !important;
  border-radius:10px !important;
  font-size:16px !important;
  padding:11px 14px !important;
  width:100% !important;
  transition:border-color .15s ease, box-shadow .15s ease !important;
}
.ffsa-pf input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):focus,
.ffsa-pf textarea:focus,
.ffsa-pf select:focus {
  border-color:${accent} !important;
  box-shadow:0 0 0 3.5px ${accent}26 !important;
  outline:none !important;
}
.ffsa-pf input::placeholder,.ffsa-pf textarea::placeholder{color:#94a3b8 !important;}
.ffsa-pf-btn-primary{transition:filter .15s ease, transform .04s ease;}
.ffsa-pf-btn-primary:hover:not(:disabled){filter:brightness(1.08);}
.ffsa-pf-btn-primary:active:not(:disabled){transform:translateY(1px);}
.ffsa-pf-btn-ghost{transition:color .15s ease;}
.ffsa-pf-btn-ghost:hover:not(:disabled){color:#0f172a;}
.ffsa-pf-outcome{transition:border-color .15s ease, background-color .15s ease;}
`;

  return (
    <div
      className="ffsa-pf"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflowY: "auto",
        background: "linear-gradient(180deg,#f8fafc 0%,#eef1f5 100%)",
        colorScheme: "light",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: scopedCss }} />

      <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          color: "#0f172a",
          boxShadow:
            "0 1px 2px rgba(15,23,42,.04), 0 12px 32px -12px rgba(15,23,42,.18)",
          border: "1px solid #eef1f5",
        }}
      >
        {/* Accent strip */}
        <div style={{ height: 5, backgroundColor: accent }} />

        <div className="px-7 sm:px-9 pt-7 pb-8">
          {/* Brand */}
          <div className="flex items-center justify-between mb-7">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-9 object-contain" />
            ) : (
              <span
                className="text-[13px] font-semibold tracking-wide"
                style={{ color: "#64748b" }}
              >
                {formName}
              </span>
            )}
          </div>

          {done ? (
            <div className="py-10 text-center">
              <div
                className="mx-auto mb-5 flex items-center justify-center rounded-full"
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: `${accent}14`,
                }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: "#0f172a" }}
              >
                {schema.thankYou.heading}
              </h1>
              <p className="text-sm mt-2" style={{ color: "#64748b" }}>
                {schema.thankYou.message}
              </p>
            </div>
          ) : (
            <>
              {/* Step indicator + progress */}
              <p
                className="text-[11px] font-semibold uppercase mb-1.5"
                style={{ color: accent, letterSpacing: "0.09em" }}
              >
                Step {stepIdx + 1} of {steps.length}
              </p>
              <h1
                className="text-[22px] font-bold tracking-tight leading-tight"
                style={{ color: "#0f172a" }}
              >
                {step.title}
              </h1>
              <div
                className="mt-4 mb-7 h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "#e9edf2" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: accent,
                    transition: "width .3s ease",
                  }}
                />
              </div>

              {/* Fields */}
              <div className="space-y-5">
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
                <p
                  className="text-sm mt-5 rounded-lg px-3 py-2"
                  style={{ color: "#b91c1c", backgroundColor: "#fef2f2" }}
                >
                  {submitError}
                </p>
              )}

              {/* Nav */}
              <div className="flex items-center justify-between mt-8">
                <button
                  type="button"
                  onClick={prev}
                  disabled={stepIdx === 0 || submitting}
                  className="ffsa-pf-btn-ghost text-sm font-medium px-1 disabled:opacity-0"
                  style={{ color: "#64748b" }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={isLastStep ? submit : next}
                  disabled={submitting}
                  className="ffsa-pf-btn-primary text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                  style={{
                    backgroundColor: accent,
                    padding: "12px 26px",
                    boxShadow: `0 6px 16px -6px ${accent}80`,
                  }}
                >
                  {submitting
                    ? "Submitting…"
                    : isLastStep
                    ? "Submit"
                    : "Continue"}
                </button>
              </div>
            </>
          )}
        </div>
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
  const labelEl = (
    <label
      className="block text-[13px] font-semibold mb-1.5"
      style={{ color: "#334155" }}
    >
      {field.label}
      {field.required && <span style={{ color: "#dc2626" }}> *</span>}
    </label>
  );
  const str = typeof value === "string" ? value : "";
  const errEl = error ? (
    <p className="text-[12px] mt-1.5" style={{ color: "#dc2626" }}>
      {error}
    </p>
  ) : null;

  // ── checkbox / consent / outcome — selectable cards ──────────
  if (field.type === "checkbox" || field.type === "consent" || field.type === "outcome") {
    const checked = value === true;
    const isOutcome = field.type === "outcome";
    return (
      <div>
        <label
          className="ffsa-pf-outcome flex items-start gap-3 cursor-pointer rounded-xl"
          style={{
            padding: isOutcome ? "14px 16px" : "12px 14px",
            border: `1.5px solid ${
              checked ? accent : error ? "#fca5a5" : "#e2e8f0"
            }`,
            backgroundColor: checked ? `${accent}0d` : "#ffffff",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            style={{ marginTop: 2, width: 17, height: 17, accentColor: accent }}
          />
          <span
            className="text-sm leading-snug"
            style={{ color: "#1e293b", fontWeight: isOutcome ? 600 : 400 }}
          >
            {field.label}
            {field.required && <span style={{ color: "#dc2626" }}> *</span>}
          </span>
        </label>
        {errEl}
      </div>
    );
  }

  let control: React.ReactNode = null;

  if (field.type === "date") {
    control = (
      <DateInput
        value={str}
        onChange={(v) => onChange(v)}
      />
    );
  } else if (
    field.type === "text" ||
    field.type === "email" ||
    field.type === "phone" ||
    field.type === "number"
  ) {
    const htmlType =
      field.type === "email"
        ? "email"
        : field.type === "phone"
        ? "tel"
        : field.type === "number"
        ? "number"
        : "text";
    control = (
      <input
        type={htmlType}
        value={str}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (field.type === "long_text") {
    control = (
      <textarea
        value={str}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
      />
    );
  } else if (field.type === "dropdown") {
    control = (
      <select value={str} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "radio") {
    control = (
      <div className="space-y-2">
        {(field.options ?? []).map((o) => {
          const sel = value === o;
          return (
            <label
              key={o}
              className="flex items-center gap-3 cursor-pointer rounded-xl text-sm"
              style={{
                padding: "11px 14px",
                border: `1.5px solid ${sel ? accent : "#e2e8f0"}`,
                backgroundColor: sel ? `${accent}0d` : "#ffffff",
                color: "#1e293b",
              }}
            >
              <input
                type="radio"
                name={field.id}
                checked={sel}
                onChange={() => onChange(o)}
                style={{ accentColor: accent }}
              />
              {o}
            </label>
          );
        })}
      </div>
    );
  } else if (field.type === "multiselect") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    control = (
      <div className="space-y-2">
        {(field.options ?? []).map((o) => {
          const sel = arr.includes(o);
          return (
            <label
              key={o}
              className="flex items-center gap-3 cursor-pointer rounded-xl text-sm"
              style={{
                padding: "11px 14px",
                border: `1.5px solid ${sel ? accent : "#e2e8f0"}`,
                backgroundColor: sel ? `${accent}0d` : "#ffffff",
                color: "#1e293b",
              }}
            >
              <input
                type="checkbox"
                checked={sel}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...arr, o] : arr.filter((x) => x !== o)
                  )
                }
                style={{ accentColor: accent }}
              />
              {o}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      {control}
      {errEl}
    </div>
  );
}
