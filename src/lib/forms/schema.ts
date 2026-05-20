// ============================================================
// Multi-step form schema — stored in forms.schema (jsonb)
// ============================================================
// A form is an ordered list of steps; each step has a title and
// an ordered list of fields. v1 is linear (no branching).
// ============================================================

export type FormFieldType =
  | "text"
  | "long_text"
  | "email"
  | "phone"
  | "date"
  | "number"
  | "dropdown"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "outcome"
  | "consent";

export type FormField = {
  id: string; // local uuid, stable within the schema
  type: FormFieldType;
  label: string;
  /**
   * Where the answer goes. A known contact column (see CONTACT_FIELD_KEYS)
   * maps into the contact record; anything else is a custom key and the
   * answer is kept in form_submissions.raw_data only.
   */
  key: string;
  required: boolean;
  options?: string[]; // dropdown / multiselect / radio
  outcomeId?: string | null; // outcome fields — binds to an event_outcome
  agreementVersion?: string | null; // consent fields
  helpText?: string | null;
};

export type FormStep = {
  id: string;
  title: string;
  fields: FormField[];
};

export type FormBranding = {
  logoUrl?: string | null;
  accentColor?: string | null; // hex, drives buttons + progress bar
};

export type FormSchema = {
  version: 1;
  branding: FormBranding;
  steps: FormStep[];
  thankYou: { heading: string; message: string };
};

// Contact columns a field key may map into. Anything else = custom.
export const CONTACT_FIELD_KEYS = [
  "first_name",
  "last_name",
  "preferred_name",
  "email",
  "phone",
  "date_of_birth",
  "gender",
  "marital_status",
  "nationality",
  "preferred_language",
  "city",
  "province",
  "country",
  "postal_code",
  "address_line_1",
  "address_line_2",
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELD_KEYS)[number];

export function isContactFieldKey(key: string): key is ContactFieldKey {
  return (CONTACT_FIELD_KEYS as readonly string[]).includes(key);
}

let idCounter = 0;
export function newLocalId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function emptyFormSchema(): FormSchema {
  return {
    version: 1,
    branding: { logoUrl: null, accentColor: "#1e40af" },
    steps: [
      {
        id: newLocalId("step"),
        title: "Get started",
        fields: [
          {
            id: newLocalId("field"),
            type: "text",
            label: "First Name",
            key: "first_name",
            required: true,
          },
          {
            id: newLocalId("field"),
            type: "text",
            label: "Last Name",
            key: "last_name",
            required: false,
          },
          {
            id: newLocalId("field"),
            type: "email",
            label: "Email",
            key: "email",
            required: true,
          },
          {
            id: newLocalId("field"),
            type: "phone",
            label: "Mobile Phone Number",
            key: "phone",
            required: false,
          },
        ],
      },
    ],
    thankYou: {
      heading: "Thank you!",
      message: "Your response has been recorded.",
    },
  };
}

// ────────────────────────────────────────────────────────────
// Validation — used by the public submit handler
// ────────────────────────────────────────────────────────────

export type ValidationResult = { valid: boolean; errors: Record<string, string> };

export function validateSubmission(
  schema: FormSchema,
  data: Record<string, unknown>
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const step of schema.steps) {
    for (const field of step.fields) {
      const raw = data[field.key];
      const isEmpty =
        raw == null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0) ||
        (field.type === "checkbox" && raw === false) ||
        (field.type === "consent" && raw !== true);

      if (field.required && isEmpty) {
        errors[field.key] = `${field.label} is required`;
        continue;
      }
      if (isEmpty) continue;

      if (field.type === "email" && typeof raw === "string") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
          errors[field.key] = "Enter a valid email address";
        }
      }
      if (field.type === "number" && typeof raw === "string" && raw.trim() !== "") {
        if (Number.isNaN(Number(raw))) {
          errors[field.key] = "Enter a number";
        }
      }
    }
  }

  // A form must collect at least one of email / phone for dedup.
  const keys = schema.steps.flatMap((s) => s.fields.map((f) => f.key));
  if (!keys.includes("email") && !keys.includes("phone")) {
    errors._form = "Form must collect an email or phone field";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
