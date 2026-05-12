"use client";

import { useController, type Control } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

export function CheckboxGroup({
  question,
  control,
}: {
  question: FormQuestion;
  control: Control<any>;
}) {
  const { field, fieldState } = useController({
    name: question.id,
    control,
    defaultValue: [],
  });

  const options = question.options ?? [];
  const selected: string[] = field.value ?? [];

  function handleToggle(value: string, checked: boolean) {
    const isNone = value.toLowerCase() === "none";

    if (checked) {
      if (isNone) {
        field.onChange([value]);
      } else {
        const without = selected.filter((v) => v.toLowerCase() !== "none");
        field.onChange([...without, value]);
      }
    } else {
      field.onChange(selected.filter((v) => v !== value));
    }
  }

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <div className="flex flex-col gap-2.5 pt-1">
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2.5">
            <Checkbox
              id={`${question.id}-${option.value}`}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                handleToggle(option.value, checked === true)
              }
              onBlur={field.onBlur}
            />
            <label
              htmlFor={`${question.id}-${option.value}`}
              className="text-sm cursor-pointer"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </FieldWrapper>
  );
}
