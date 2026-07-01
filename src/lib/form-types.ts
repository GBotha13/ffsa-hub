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
  | "consent"
  | "section_header";

export type FormQuestion = {
  id: string;
  section: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  validation?: Record<string, unknown>;
  parentQuestionId?: string | null;
  showWhenAnswer?: string | null;
  systemKey?: string | null;
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
  parent_question_id?: string | null;
  show_when_answer?: string | null;
  system_key?: string | null;
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
    case "section_header":
      type = "section_header";
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
    parentQuestionId: q.parent_question_id ?? null,
    showWhenAnswer: q.show_when_answer ?? null,
    systemKey: q.system_key ?? null,
  };
}

// Reorders questions so each conditional follow-up appears directly
// after its parent (depth-first walk by parent id). Top-level siblings
// keep their input order — typically `sort_order` from the DB. Without
// this, follow-ups added later carry the highest sort_order and end up
// rendered at the bottom of the form instead of under the question they
// depend on.
//
// Returns the ordered list plus a depth lookup so renderers can indent
// follow-ups to visually mirror the admin question tree. Defensively
// guards against cycles, and falls back to appending any orphaned
// children (parent missing from the input) at the end.
export function orderQuestionsForRender<Q extends { id: string }>(
  questions: Q[],
  getParentId: (q: Q) => string | null | undefined
): { ordered: Q[]; depthById: Map<string, number> } {
  const byParent = new Map<string | null, Q[]>();
  for (const q of questions) {
    const key = getParentId(q) ?? null;
    const list = byParent.get(key) ?? [];
    list.push(q);
    byParent.set(key, list);
  }

  const ordered: Q[] = [];
  const depthById = new Map<string, number>();
  const visited = new Set<string>();

  function walk(parentId: string | null, depth: number): void {
    const siblings = byParent.get(parentId) ?? [];
    for (const q of siblings) {
      if (visited.has(q.id)) continue; // cycle guard
      visited.add(q.id);
      ordered.push(q);
      depthById.set(q.id, depth);
      walk(q.id, depth + 1);
    }
  }
  walk(null, 0);

  // Append any orphans (parent_question_id pointing at a question not in
  // this list) at the end so they never disappear from the form.
  for (const q of questions) {
    if (visited.has(q.id)) continue;
    visited.add(q.id);
    ordered.push(q);
    depthById.set(q.id, 0);
  }

  return { ordered, depthById };
}

// Returns true if `question` should be shown given the current form values.
// A question is shown when its parent chain is fully satisfied — every
// ancestor's current answer must match its `showWhenAnswer`.
export function isQuestionVisible(
  question: FormQuestion,
  questionsById: Map<string, FormQuestion>,
  values: Record<string, unknown>
): boolean {
  let current = question;
  const seen = new Set<string>();
  while (current.parentQuestionId) {
    if (seen.has(current.id)) return false; // cycle guard
    seen.add(current.id);
    const parent = questionsById.get(current.parentQuestionId);
    if (!parent) return false;
    const parentValue = values[parent.id];
    const parentAnswer = typeof parentValue === "string" ? parentValue : "";
    if (parentAnswer !== current.showWhenAnswer) return false;
    current = parent;
  }
  return true;
}
