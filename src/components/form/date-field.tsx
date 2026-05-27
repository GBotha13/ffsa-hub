"use client";

import { useController, type Control } from "react-hook-form";
import { DateInput } from "@/components/ui/date-input";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

export function DateField({
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
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <DateInput
        id={question.id}
        value={field.value ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        aria-invalid={!!fieldState.error}
        aria-describedby={fieldState.error ? `${question.id}-error` : undefined}
      />
    </FieldWrapper>
  );
}
