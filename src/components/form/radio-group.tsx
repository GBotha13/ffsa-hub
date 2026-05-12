"use client";

import { useController, type Control } from "react-hook-form";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

export function RadioGroup({
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

  const options = question.options ?? [];

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <div className="flex flex-col gap-2 pt-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={field.value === option.value}
              onChange={() => field.onChange(option.value)}
              onBlur={field.onBlur}
              className="accent-[hsl(42,95%,55%)]"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </FieldWrapper>
  );
}
