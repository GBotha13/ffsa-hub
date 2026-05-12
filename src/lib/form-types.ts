export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "date"
  | "country"
  | "yes_no"
  | "select"
  | "radio"
  | "checkbox_group"
  | "file"
  | "consent";

export type FormQuestion = {
  id: string;
  section: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  validation?: Record<string, unknown>;
};

export type FileValue = {
  storagePath: string;
  mimeType: string;
  size: number;
  originalName: string;
};

export const PERSONAL_INFO_FIELDS: FormQuestion[] = [
  { id: "first_name", section: "personal", type: "short_text", label: "First Name", required: true },
  { id: "last_name", section: "personal", type: "short_text", label: "Last Name", required: true },
  { id: "email", section: "personal", type: "email", label: "Email", required: true },
  { id: "phone", section: "personal", type: "phone", label: "Phone", required: false },
  { id: "date_of_birth", section: "personal", type: "date", label: "Date of Birth", required: false },
  {
    id: "gender",
    section: "personal",
    type: "select",
    label: "Gender",
    required: false,
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    ],
  },
  { id: "nationality", section: "personal", type: "country", label: "Nationality", required: false },
  { id: "country", section: "personal", type: "country", label: "Country", required: false },
  { id: "city", section: "personal", type: "short_text", label: "City", required: false },
];

type DbQuestion = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  is_required: boolean;
  options: string[] | null;
};

export function mapDbQuestion(q: DbQuestion): FormQuestion {
  let type: FormFieldType;
  switch (q.type) {
    case "multiple_choice":
      type = "radio";
      break;
    case "long_answer":
      type = "long_text";
      break;
    case "yes_no":
      type = "yes_no";
      break;
    case "checkbox_group":
      type = "checkbox_group";
      break;
    case "country":
      type = "country";
      break;
    case "phone":
      type = "phone";
      break;
    case "date":
      type = "date";
      break;
    case "email":
      type = "email";
      break;
    case "file":
      type = "file";
      break;
    case "consent":
      type = "consent";
      break;
    case "select":
      type = "select";
      break;
    default:
      type = "short_text";
      break;
  }

  return {
    id: q.id,
    section: "questions",
    type,
    label: q.label,
    helpText: q.description ?? undefined,
    required: q.is_required,
    options: q.options?.map((o, i) => {
      const seen = q.options!.slice(0, i).filter((prev) => prev === o).length;
      return { value: seen > 0 ? `${o}__${i}` : o, label: o };
    }),
  };
}
