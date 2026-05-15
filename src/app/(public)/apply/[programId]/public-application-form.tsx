"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/form/form-field";
import { ErrorSummary } from "@/components/form/error-summary";
import { buildFormSchema } from "@/lib/build-form-schema";
import {
  mapDbQuestion,
  type FormQuestion,
  type FileValue,
} from "@/lib/form-types";
import { CheckCircle2, Loader2, Copy, Check } from "lucide-react";

type DbQuestion = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  is_required: boolean;
  options: string[] | null;
};

type ReferenceSlot = {
  id: string;
  label: string;
  description: string | null;
  is_required: boolean;
};

type ReferenceLink = { label: string; url: string };

function SuccessScreen({
  programName,
  referenceLinks,
}: {
  programName: string;
  referenceLinks: ReferenceLink[];
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copyToClipboard(url: string, idx: number) {
    navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="text-center space-y-6 py-8">
      <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          Application Received
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Thank you for applying to {programName}. We&apos;ve sent a
          confirmation to your email. Our team will review your application and
          get back to you soon.
        </p>
      </div>

      {referenceLinks.length > 0 && (
        <div className="space-y-3 max-w-md mx-auto text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reference Links
          </p>
          <p className="text-xs text-muted-foreground">
            Send these links to your referees so they can submit their references:
          </p>

          <div className="space-y-2">
            {referenceLinks.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-md border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {link.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {link.url}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(link.url, idx)}
                >
                  {copiedIdx === idx ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PublicApplicationForm({
  programId,
  programName,
  questions,
  referenceSlots = [],
}: {
  programId: string;
  programName: string;
  questions: DbQuestion[];
  referenceSlots?: ReferenceSlot[];
}) {
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<ReferenceLink[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [refNames, setRefNames] = useState<Record<string, string>>({});
  const [refEmails, setRefEmails] = useState<Record<string, string>>({});

  const allQuestions: FormQuestion[] = useMemo(
    () => questions.map(mapDbQuestion),
    [questions]
  );

  const schema = useMemo(
    () => buildFormSchema(allQuestions),
    [allQuestions]
  );

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const q of allQuestions) {
      if (q.type === "section_header") continue;
      if (q.type === "checkbox_group") {
        defaults[q.id] = [];
      } else if (q.type === "consent") {
        defaults[q.id] = false;
      } else if (q.type === "file") {
        defaults[q.id] = null;
      } else {
        defaults[q.id] = "";
      }
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

  async function onSubmit(data: Record<string, unknown>) {
    setServerError(null);

    const answers: Array<{
      question_id: string;
      question_label: string;
      answer: string;
    }> = [];
    const files: Array<{
      questionId: string;
      storagePath: string;
      mimeType: string;
      size: number;
    }> = [];

    for (const q of allQuestions) {
      if (q.type === "section_header") continue;
      const value = data[q.id];
      if (q.type === "file" && value && typeof value === "object") {
        const fv = value as FileValue;
        files.push({
          questionId: q.id,
          storagePath: fv.storagePath,
          mimeType: fv.mimeType,
          size: fv.size,
        });
        answers.push({
          question_id: q.id,
          question_label: q.label,
          answer: fv.storagePath,
        });
      } else if (q.type === "checkbox_group" && Array.isArray(value)) {
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

    const references = referenceSlots
      .filter(
        (slot) =>
          refNames[slot.id]?.trim() && refEmails[slot.id]?.trim()
      )
      .map((slot) => ({
        slot_id: slot.id,
        referee_name: refNames[slot.id].trim(),
        referee_email: refEmails[slot.id].trim(),
      }));

    try {
      const res = await fetch("/api/public/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          answers,
          references,
          files: files.length > 0 ? files : undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || "Failed to submit application");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setApplicationId(result.id);
      setReferenceLinks(result.referenceLinks ?? []);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setServerError("Network error. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function onError() {
    setHasAttemptedSubmit(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <SuccessScreen
        programName={programName}
        referenceLinks={referenceLinks}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onError)}
      className="space-y-8"
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

      {/* Application Questions */}
      {allQuestions.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          {allQuestions.map((q) => (
            <FormField
              key={q.id}
              question={q}
              control={control}
              applicationId={applicationId || programId}
            />
          ))}
        </div>
      )}

      {/* References */}
      {referenceSlots.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">References</h2>
          <p className="text-sm text-muted-foreground">
            Please provide contact details for the following references. They
            will receive an email with a link to submit their reference.
          </p>

          {referenceSlots.map((slot) => (
            <div key={slot.id} className="space-y-3 rounded-md border p-4">
              <div>
                <p className="text-sm font-medium">
                  {slot.label}
                  {slot.is_required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </p>
                {slot.description && (
                  <p className="text-xs text-muted-foreground">
                    {slot.description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`ref_${slot.id}_name`}>
                    Referee Name
                    {slot.is_required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  <Input
                    id={`ref_${slot.id}_name`}
                    placeholder="Full name"
                    value={refNames[slot.id] ?? ""}
                    onChange={(e) =>
                      setRefNames((prev) => ({
                        ...prev,
                        [slot.id]: e.target.value,
                      }))
                    }
                    required={slot.is_required}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ref_${slot.id}_email`}>
                    Referee Email
                    {slot.is_required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  <Input
                    id={`ref_${slot.id}_email`}
                    type="email"
                    placeholder="referee@email.com"
                    value={refEmails[slot.id] ?? ""}
                    onChange={(e) =>
                      setRefEmails((prev) => ({
                        ...prev,
                        [slot.id]: e.target.value,
                      }))
                    }
                    required={slot.is_required}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
          "SUBMIT APPLICATION"
        )}
      </Button>
    </form>
  );
}

