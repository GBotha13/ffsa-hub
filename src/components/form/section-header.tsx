"use client";

import type { FormQuestion } from "@/lib/form-types";

export function SectionHeader({ question }: { question: FormQuestion }) {
  return (
    <div className="pt-4 pb-1">
      <h3 className="text-base font-semibold text-foreground">{question.label}</h3>
      {question.helpText && (
        <p className="text-sm text-muted-foreground mt-1">{question.helpText}</p>
      )}
    </div>
  );
}
