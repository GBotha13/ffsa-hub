import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { isQuestionVisible, type FormQuestion } from "./form-types";

function isRealDate(value: string): boolean {
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const [y, m, day] = value.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

function isAtLeast16(value: string): boolean {
  const dob = new Date(value);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 16;
}

// For a follow-up question to be answered correctly, its value must be present
// and non-empty in a type-appropriate way.
function isAnswerEmpty(q: FormQuestion, value: unknown): boolean {
  if (q.type === "checkbox_group") {
    return !Array.isArray(value) || value.length === 0;
  }
  if (q.type === "consent") {
    return value !== true;
  }
  if (q.type === "file") {
    return !value || typeof value !== "object";
  }
  return value === undefined || value === null || value === "";
}

function requiredMessageFor(q: FormQuestion): string {
  switch (q.type) {
    case "yes_no":
    case "radio":
    case "select":
      return "Please select an option";
    case "country":
      return "Please select a country";
    case "checkbox_group":
      return "Please select at least one option";
    case "file":
      return "Please upload a file";
    case "consent":
      return "You must accept to continue";
    default:
      return "This field is required";
  }
}

export function buildFormSchema(questions: FormQuestion[]) {
  const shape: Record<string, z.ZodType> = {};
  const questionsById = new Map(questions.map((q) => [q.id, q]));

  for (const q of questions) {
    if (q.type === "section_header") continue;

    // Follow-up questions are conditionally required — handled in superRefine.
    // At the type-level, treat them as optional so the form passes static
    // validation when the parent answer hides them.
    const isFollowUp = !!q.parentQuestionId;
    const required = q.required && !isFollowUp;

    let field: z.ZodType;

    switch (q.type) {
      case "short_text":
        field = required
          ? z.string().min(1, "This field is required")
          : z.string().optional().or(z.literal(""));
        break;

      case "email":
        field = required
          ? z.string().min(1, "This field is required").email("Please enter a valid email")
          : z.string().email("Please enter a valid email").optional().or(z.literal(""));
        break;

      case "phone":
        if (required) {
          field = z
            .string()
            .min(1, "This field is required")
            .refine((val) => isValidPhoneNumber(val), "Please enter a valid phone number");
        } else {
          field = z
            .string()
            .optional()
            .or(z.literal(""))
            .refine(
              (val) => !val || isValidPhoneNumber(val),
              "Please enter a valid phone number"
            );
        }
        break;

      case "date":
        if (required) {
          field = z
            .string()
            .min(1, "This field is required")
            .refine(isRealDate, "Please enter a valid date")
            .refine(isAtLeast16, "Applicant must be at least 16 years old");
        } else {
          field = z
            .string()
            .optional()
            .or(z.literal(""))
            .refine(
              (val) => !val || isRealDate(val),
              "Please enter a valid date"
            )
            .refine(
              (val) => !val || isAtLeast16(val),
              "Applicant must be at least 16 years old"
            );
        }
        break;

      case "country":
        field = required
          ? z.string().min(1, "Please select a country")
          : z.string().optional().or(z.literal(""));
        break;

      case "yes_no":
        field = required
          ? z.string().min(1, "Please select an option")
          : z.string().optional().or(z.literal(""));
        break;

      case "select":
      case "radio":
        field = required
          ? z.string().min(1, "Please select an option")
          : z.string().optional().or(z.literal(""));
        break;

      case "checkbox_group":
        field = required
          ? z.array(z.string()).min(1, "Please select at least one option")
          : z.array(z.string()).optional();
        break;

      case "long_text":
        field = required
          ? z.string().min(1, "This field is required")
          : z.string().optional().or(z.literal(""));
        break;

      case "file":
        if (required) {
          field = z.object(
            {
              storagePath: z.string(),
              mimeType: z.string(),
              size: z.number(),
              originalName: z.string(),
            },
            { message: "Please upload a file" }
          );
        } else {
          field = z
            .object({
              storagePath: z.string(),
              mimeType: z.string(),
              size: z.number(),
              originalName: z.string(),
            })
            .nullable()
            .optional();
        }
        break;

      case "consent":
        // Follow-up consents: required only if visible — checked in superRefine.
        field = isFollowUp
          ? z.boolean().optional()
          : z.literal(true, { message: "You must accept to continue" });
        break;

      default:
        field = required
          ? z.string().min(1, "This field is required")
          : z.string().optional().or(z.literal(""));
    }

    shape[q.id] = field;
  }

  return z.object(shape).superRefine((data, ctx) => {
    const values = data as Record<string, unknown>;
    for (const q of questions) {
      if (q.type === "section_header") continue;
      if (!q.required || !q.parentQuestionId) continue;
      if (!isQuestionVisible(q, questionsById, values)) continue;
      if (isAnswerEmpty(q, values[q.id])) {
        ctx.addIssue({
          path: [q.id],
          code: z.ZodIssueCode.custom,
          message: requiredMessageFor(q),
        });
      }
    }
  });
}
