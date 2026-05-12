"use client";

import { useCallback } from "react";
import { useController, type Control } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

export function LongText({
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

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <Textarea
        id={question.id}
        rows={3}
        value={field.value ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onInput={handleInput}
        aria-invalid={!!fieldState.error}
        aria-describedby={fieldState.error ? `${question.id}-error` : undefined}
      />
    </FieldWrapper>
  );
}
