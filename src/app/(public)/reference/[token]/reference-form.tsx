"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import { FormField } from "@/components/form/form-field";
import { ErrorSummary } from "@/components/form/error-summary";
import { buildFormSchema } from "@/lib/build-form-schema";
import {
  mapDbQuestion,
  isQuestionVisible,
  orderQuestionsForRender,
  type FormQuestion,
} from "@/lib/form-types";

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

  // Reorder so follow-ups render directly under their parent (and indent
  // them via depthById) instead of falling to the bottom by sort_order.
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
        setServerError(result.error || "Failed to submit reference. Please try again.");
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
      <div className="min-h-screen flex flex-col" style={{ background: "#0D0B09" }}>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: "hsl(142 55% 58%)" }} />
            <h1 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", color: "#F0EBE3", letterSpacing: "0.04em" }}>
              Thank You!
            </h1>
            <p className="text-sm" style={{ color: "#B8A898" }}>
              Your reference for {applicantName} has been submitted successfully.
              The admissions team will review it along with the application.
            </p>
          </div>
        </div>
        <p style={{ textAlign: "center", padding: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "hsl(30 8% 22%)", textTransform: "uppercase" }}>
          Catalyse a Generation · Evangelise the World
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0D0B09" }}>
      <div
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid hsl(22 8% 12%)" }}
      >
        <div className="flex items-center gap-3">
          <Image src="/ff-logo.png" alt="Fire & Fragrance" width={80} height={20} style={{ objectFit: "contain" }} priority />
          <div style={{ height: "1px", width: "12px", background: "var(--yellow)" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.3em", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase" }}>
            HUB
          </span>
        </div>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "hsl(30 8% 42%)", textTransform: "uppercase" }}>
          Reference Form
        </p>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div
            style={{
              background: "hsl(22 10% 8%)",
              border: "1px solid hsl(22 8% 14%)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "1.75rem 2rem 1.25rem", borderBottom: "1px solid hsl(22 8% 12%)" }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "6px" }}>
                {slotLabel}
              </p>
              <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "1.75rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                Reference for {applicantName}
              </h2>
              <p style={{ fontSize: "12px", color: "hsl(30 8% 55%)", marginTop: "6px" }}>
                Application to <strong style={{ color: "#F0EBE3" }}>{programName}</strong>
              </p>
              {slotDescription && (
                <p style={{ fontSize: "12px", color: "hsl(30 8% 55%)", marginTop: "6px" }}>
                  {slotDescription}
                </p>
              )}
              <p style={{ fontSize: "12px", color: "hsl(30 8% 45%)", marginTop: "12px", lineHeight: 1.5 }}>
                Thank you for agreeing to fill out this reference form. Please fill it out truthfully and with discretion.
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit, onError)}
              className="space-y-6"
              style={{ padding: "1.5rem 2rem 2rem" }}
              noValidate
            >
              {serverError && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">{serverError}</p>
                </div>
              )}

              {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
                <ErrorSummary errors={errors} questions={allQuestions} />
              )}

              {visibleQuestions.length === 0 ? (
                <p className="text-sm" style={{ color: "#B8A898" }}>
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "SUBMIT REFERENCE"
                  )}
                </Button>
              )}
            </form>
          </div>
          <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "hsl(30 8% 22%)", textTransform: "uppercase" }}>
            Catalyse a Generation · Evangelise the World
          </p>
        </div>
      </div>
    </div>
  );
}
