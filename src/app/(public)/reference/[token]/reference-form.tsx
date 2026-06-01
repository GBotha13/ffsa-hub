"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FormField } from "@/components/form/form-field";
import { ErrorSummary } from "@/components/form/error-summary";
import { buildFormSchema } from "@/lib/build-form-schema";
import {
  mapDbQuestion,
  isQuestionVisible,
  orderQuestionsForRender,
  type FormQuestion,
} from "@/lib/form-types";
import {
  PublicFormShell,
  PublicFormInputStyles,
  PUBLIC_SHELL_TOKENS,
} from "@/components/public-form-shell";

const T = PUBLIC_SHELL_TOKENS;

type DbQuestion = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  is_required: boolean;
  options: string[] | null;
  parent_question_id?: string | null;
  show_when_answer?: string | null;
};

export function ReferenceForm({
  token,
  applicantName,
  programName,
  slotLabel,
  slotDescription,
  questions,
}: {
  token: string;
  refereeName: string;
  applicantName: string;
  programName: string;
  slotLabel: string;
  slotDescription: string | null;
  questions: DbQuestion[];
}) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const { allQuestions, depthById } = useMemo<{
    allQuestions: FormQuestion[];
    depthById: Map<string, number>;
  }>(() => {
    const mapped = questions.map(mapDbQuestion);
    const { ordered, depthById } = orderQuestionsForRender(
      mapped,
      (q) => q.parentQuestionId
    );
    return { allQuestions: ordered, depthById };
  }, [questions]);

  const questionsById = useMemo(
    () => new Map(allQuestions.map((q) => [q.id, q])),
    [allQuestions]
  );

  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of allQuestions) {
      if (q.parentQuestionId) ids.add(q.parentQuestionId);
    }
    return Array.from(ids);
  }, [allQuestions]);

  const schema = useMemo(() => buildFormSchema(allQuestions), [allQuestions]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const q of allQuestions) {
      if (q.type === "section_header") continue;
      if (q.type === "checkbox_group") defaults[q.id] = [];
      else if (q.type === "consent") defaults[q.id] = false;
      else if (q.type === "file") defaults[q.id] = null;
      else defaults[q.id] = "";
    }
    return defaults;
  }, [allQuestions]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const watchedParentValues = useWatch({ control, name: parentIds });

  const visibleQuestionIds = useMemo(() => {
    const parentValueMap: Record<string, unknown> = {};
    if (parentIds.length > 0 && Array.isArray(watchedParentValues)) {
      parentIds.forEach((id, idx) => {
        parentValueMap[id] = watchedParentValues[idx];
      });
    }
    const ids = new Set<string>();
    for (const q of allQuestions) {
      if (isQuestionVisible(q, questionsById, parentValueMap)) ids.add(q.id);
    }
    return ids;
  }, [allQuestions, questionsById, parentIds, watchedParentValues]);

  const visibleQuestions = useMemo(
    () => allQuestions.filter((q) => visibleQuestionIds.has(q.id)),
    [allQuestions, visibleQuestionIds]
  );

  async function onSubmit(data: Record<string, unknown>) {
    setServerError(null);

    const answers: Array<{
      question_id: string;
      question_label: string;
      answer: string;
    }> = [];

    for (const q of allQuestions) {
      if (q.type === "section_header") continue;
      if (!visibleQuestionIds.has(q.id)) continue;
      const value = data[q.id];
      if (q.type === "checkbox_group" && Array.isArray(value)) {
        answers.push({
          question_id: q.id,
          question_label: q.label,
          answer: (value as string[]).join(", "),
        });
      } else if (q.type === "consent") {
        answers.push({
          question_id: q.id,
          question_label: q.label,
          answer: value ? "Yes" : "No",
        });
      } else {
        answers.push({
          question_id: q.id,
          question_label: q.label,
          answer: String(value ?? ""),
        });
      }
    }

    try {
      const res = await fetch("/api/public/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
      });
      const result = await res.json();
      if (!res.ok) {
        setServerError(
          result.error || "Failed to submit reference. Please try again."
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  function onError() {
    setHasAttemptedSubmit(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <PublicFormShell eyebrow="Thank You" heading="Reference submitted" maxWidth={520}>
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="h-12 w-12" style={{ color: T.green }} />
        </div>
        <p
          style={{
            fontSize: 15,
            color: T.textDim,
            lineHeight: 1.6,
            margin: 0,
            textAlign: "center",
          }}
        >
          Your reference for {applicantName} has been submitted successfully.
          The admissions team will review it along with the application.
        </p>
      </PublicFormShell>
    );
  }

  return (
    <div className="ffsa-public">
      <PublicFormInputStyles />
      <PublicFormShell
        eyebrow={slotLabel}
        heading={`Reference for ${applicantName}`}
        subheading={`Application to ${programName}. Thank you for agreeing to fill out this reference form — please fill it out truthfully and with discretion.`}
        maxWidth={680}
      >
        {slotDescription && (
          <p
            className="mb-5"
            style={{
              fontSize: 13,
              color: T.textDimmer,
              fontStyle: "italic",
              lineHeight: 1.55,
              margin: "0 0 20px",
            }}
          >
            {slotDescription}
          </p>
        )}

        <form
          onSubmit={handleSubmit(onSubmit, onError)}
          className="space-y-6"
          noValidate
        >
          {serverError && (
            <div
              className="rounded-lg p-4"
              style={{
                color: T.red,
                background: `${T.red}1a`,
                border: `1px solid ${T.red}33`,
                fontSize: 13,
              }}
            >
              {serverError}
            </div>
          )}

          {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
            <ErrorSummary errors={errors} questions={allQuestions} />
          )}

          {visibleQuestions.length === 0 ? (
            <p style={{ fontSize: 14, color: T.textDim }}>
              This program has not configured any reference questions yet.
              Please check back later or contact the school administrator.
            </p>
          ) : (
            <div className="space-y-4">
              {visibleQuestions.map((q) => {
                const depth = depthById.get(q.id) ?? 0;
                return (
                  <div
                    key={q.id}
                    style={
                      depth > 0
                        ? { marginLeft: `${depth * 16}px` }
                        : undefined
                    }
                  >
                    <FormField question={q} control={control} />
                  </div>
                );
              })}
            </div>
          )}

          {visibleQuestions.length > 0 && (
            <button
              type="submit"
              className="ffsa-public-btn-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </span>
              ) : (
                "Submit reference"
              )}
            </button>
          )}
        </form>
      </PublicFormShell>
    </div>
  );
}
