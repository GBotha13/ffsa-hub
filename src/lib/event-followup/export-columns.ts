// Column registry for the Event Follow-up CSV export. Shared by the export
// API route (which builds the CSV) and the queue UI (which renders the column
// picker), so the two can never drift.

export type ExportColumnKey =
  | "event"
  | "first_name"
  | "last_name"
  | "preferred_name"
  | "email"
  | "phone"
  | "outcome"
  | "workflow"
  | "status"
  | "stage"
  | "step"
  | "total_steps"
  | "days_in_pipeline"
  | "enrolled_at"
  | "completed_at"
  | "marked_finished_at"
  | "assigned_staff"
  | "assigned_staff_email"
  | "form_answers"
  | "staff_notes";

// Canonical CSV column order — also the default emitted when nothing is
// deselected, so an un-customized download matches the historical output.
export const EXPORT_COLUMN_ORDER: ExportColumnKey[] = [
  "event",
  "first_name",
  "last_name",
  "preferred_name",
  "email",
  "phone",
  "outcome",
  "workflow",
  "status",
  "stage",
  "step",
  "total_steps",
  "days_in_pipeline",
  "enrolled_at",
  "completed_at",
  "marked_finished_at",
  "assigned_staff",
  "assigned_staff_email",
  "form_answers",
  "staff_notes",
];

export const EXPORT_COLUMN_LABELS: Record<ExportColumnKey, string> = {
  event: "Event",
  first_name: "First Name",
  last_name: "Last Name",
  preferred_name: "Preferred Name",
  email: "Email",
  phone: "Phone",
  outcome: "Outcome",
  workflow: "Workflow",
  status: "Status",
  stage: "Stage",
  step: "Step",
  total_steps: "Total Steps",
  days_in_pipeline: "Days In Pipeline",
  enrolled_at: "Enrolled At",
  completed_at: "Completed At",
  marked_finished_at: "Marked Finished At",
  assigned_staff: "Assigned Staff",
  assigned_staff_email: "Assigned Staff Email",
  form_answers: "Form answers (all signup questions)",
  staff_notes: "Staff notes",
};

// Grouping for the column-picker UI. (CSV order stays EXPORT_COLUMN_ORDER.)
export const EXPORT_COLUMN_GROUPS: { group: string; keys: ExportColumnKey[] }[] =
  [
    {
      group: "Contact",
      keys: ["first_name", "last_name", "preferred_name", "email", "phone"],
    },
    {
      group: "Event & pipeline",
      keys: [
        "event",
        "outcome",
        "workflow",
        "status",
        "stage",
        "step",
        "total_steps",
        "days_in_pipeline",
        "enrolled_at",
        "completed_at",
        "marked_finished_at",
      ],
    },
    { group: "Assignment", keys: ["assigned_staff", "assigned_staff_email"] },
    { group: "Extra", keys: ["form_answers", "staff_notes"] },
  ];

const KEY_SET = new Set<string>(EXPORT_COLUMN_ORDER);

export function isExportColumnKey(s: string): s is ExportColumnKey {
  return KEY_SET.has(s);
}

// Parse the ?columns= query param (comma-separated keys), returning the
// selected keys in canonical order. Null / empty / all-invalid → every column
// (so old links and "select everything" both yield the full CSV).
export function parseExportColumns(param: string | null): ExportColumnKey[] {
  if (!param) return [...EXPORT_COLUMN_ORDER];
  const requested = new Set(
    param
      .split(",")
      .map((s) => s.trim())
      .filter(isExportColumnKey)
  );
  if (requested.size === 0) return [...EXPORT_COLUMN_ORDER];
  return EXPORT_COLUMN_ORDER.filter((k) => requested.has(k));
}
