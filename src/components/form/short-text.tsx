"use client";

import { useController, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

export function ShortText({
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

  const inputType = question.type === "email" ? "email" : "text";

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <Input
        id={question.id}
        type={inputType}
        value={field.value ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        aria-invalid={!!fieldState.error}
        aria-describedby={fieldState.error ? `${question.id}-error` : undefined}
      />
    </FieldWrapper>
  );
}
