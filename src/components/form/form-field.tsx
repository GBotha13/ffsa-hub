"use client";

import type { Control } from "react-hook-form";
import type { FormQuestion } from "@/lib/form-types";
import { ShortText } from "./short-text";
import { LongText } from "./long-text";
import { DateField } from "./date-field";
import { YesNoSelect } from "./yes-no-select";
import { RadioGroup } from "./radio-group";
import { ConsentCheckbox } from "./consent-checkbox";
import { PhoneInput } from "./phone-input";
import { CountrySelect } from "./country-select";
import { CheckboxGroup } from "./checkbox-group";
import { FileUpload } from "./file-upload";
import { SectionHeader } from "./section-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useController } from "react-hook-form";
import { FieldWrapper } from "./field-wrapper";

function GenericSelect({
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
      <Select value={field.value ?? ""} onValueChange={field.onChange}>
        <SelectTrigger id={question.id} onBlur={field.onBlur}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {(question.options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

export function FormField({
  question,
  control,
  applicationId,
}: {
  question: FormQuestion;
  control: Control<any>;
  applicationId?: string;
}) {
  switch (question.type) {
    case "short_text":
    case "email":
      return <ShortText question={question} control={control} />;
    case "long_text":
      return <LongText question={question} control={control} />;
    case "date":
      return <DateField question={question} control={control} />;
    case "yes_no":
      return <YesNoSelect question={question} control={control} />;
    case "radio":
      return <RadioGroup question={question} control={control} />;
    case "consent":
      return <ConsentCheckbox question={question} control={control} />;
    case "phone":
      return <PhoneInput question={question} control={control} />;
    case "country":
      return <CountrySelect question={question} control={control} />;
    case "checkbox_group":
      return <CheckboxGroup question={question} control={control} />;
    case "file":
      return (
        <FileUpload
          question={question}
          control={control}
          applicationId={applicationId}
        />
      );
    case "select":
      return <GenericSelect question={question} control={control} />;
    case "section_header":
      return <SectionHeader question={question} />;
    default:
      return <ShortText question={question} control={control} />;
  }
}
