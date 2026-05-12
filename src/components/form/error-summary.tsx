"use client";

import type { FieldErrors } from "react-hook-form";
import type { FormQuestion } from "@/lib/form-types";

export function ErrorSummary({
  errors,
  questions,
}: {
  errors: FieldErrors;
  questions: FormQuestion[];
}) {
  const errorKeys = Object.keys(errors);
  if (errorKeys.length === 0) return null;

  const questionMap = new Map(questions.map((q) => [q.id, q.label]));

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-2">
      <p className="text-sm font-medium text-destructive">
        Please fix {errorKeys.length} field{errorKeys.length > 1 ? "s" : ""}{" "}
        below
      </p>
      <ul className="space-y-1">
        {errorKeys.map((key) => {
          const label = questionMap.get(key) || key;
          return (
            <li key={key}>
              <a
                href={`#field-${key}`}
                className="text-xs text-destructive underline hover:no-underline"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`field-${key}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
