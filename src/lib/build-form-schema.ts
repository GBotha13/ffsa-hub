import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { FormQuestion } from "./form-types";

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

export function buildFormSchema(questions: FormQuestion[]) {
  const shape: Record<string, z.ZodType> = {};

  for (const q of questions) {
    let field: z.ZodType;

    switch (q.type) {
      case "short_text":
        field = q.required
          ? z.string().min(1, "This field is required")
          : z.string().optional().or(z.literal(""));
        break;

      case "email":
        field = q.required
          ? z.string().min(1, "This field is required").email("Please enter a valid email")
          : z.string().email("Please enter a valid email").optional().or(z.literal(""));
        break;

      case "phone":
        if (q.required) {
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
        if (q.required) {
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
        field = q.required
          ? z.string().min(1, "Please select a country")
          : z.string().optional().or(z.literal(""));
        break;

      case "yes_no":
        field = q.required
          ? z.string().min(1, "Please select an option")
          : z.string().optional().or(z.literal(""));
        break;

      case "select":
      case "radio":
        field = q.required
          ? z.string().min(1, "Please select an option")
          : z.string().optional().or(z.literal(""));
        break;

      case "checkbox_group":
        field = q.required
          ? z.array(z.string()).min(1, "Please select at least one option")
          : z.array(z.string()).optional();
        break;

      case "long_text":
        field = q.required
          ? z.string().min(1, "This field is required")
          : z.string().optional().or(z.literal(""));
        break;

      case "file":
        if (q.required) {
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
        field = z.literal(true, {
          message: "You must accept to continue",
        });
        break;

      default:
        field = q.required
          ? z.string().min(1, "This field is required")
          : z.string().optional().or(z.literal(""));
    }

    shape[q.id] = field;
  }

  return z.object(shape);
}
