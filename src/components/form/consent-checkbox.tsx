"use client";

import { useController, type Control } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import type { FormQuestion } from "@/lib/form-types";

export function ConsentCheckbox({
  question,
  control,
}: {
  question: FormQuestion;
  control: Control<any>;
}) {
  const { field, fieldState } = useController({
    name: question.id,
    control,
  });

  return (
    <div className="space-y-1.5" id={`field-${question.id}`}>
      <div className="flex items-start gap-3 pt-1">
        <Checkbox
          id={question.id}
          checked={field.value === true}
          onCheckedChange={(checked) => field.onChange(checked === true)}
          onBlur={field.onBlur}
          aria-invalid={!!fieldState.error}
        />
        <label
          htmlFor={question.id}
          className="text-sm leading-relaxed cursor-pointer"
        >
          {question.label}
          <span className="text-destructive ml-0.5">*</span>
        </label>
      </div>
      {fieldState.error && (
        <p
          className="text-xs text-destructive"
          role="alert"
          id={`${question.id}-error`}
        >
          {fieldState.error.message}
        </p>
      )}
    </div>
  );
}
