// ────────────────────────────────────────────────────────────
// REQUIRED PROFILE FIELDS — single source of truth
// ────────────────────────────────────────────────────────────
// This list is consumed by:
//   - ProfileCompletionGate: blocks the app until these are filled
//   - lifecycle.ts: derives the "Profile Incomplete" badge on the
//     Users admin table so super admins can see who's stuck
// Add a field here and both surfaces pick it up automatically.

export type FieldConfig = {
  field: string;
  label: string;
  type: "text" | "select" | "date" | "tel";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export const REQUIRED_PROFILE_FIELDS: FieldConfig[] = [
  // ── Personal ─────────────────────────────────────────────
  { field: "first_name", label: "First Name", type: "text", placeholder: "Your first name" },
  { field: "last_name", label: "Last Name", type: "text", placeholder: "Your last name" },
  {
    field: "gender",
    label: "Gender",
    type: "select",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    ],
  },
  {
    field: "marital_status",
    label: "Marital Status",
    type: "select",
    options: [
      { value: "single", label: "Single" },
      { value: "married", label: "Married" },
      { value: "divorced", label: "Divorced" },
      { value: "widowed", label: "Widowed" },
    ],
  },
  { field: "date_of_birth", label: "Date of Birth", type: "date" },
  { field: "nationality", label: "Nationality", type: "text", placeholder: "e.g. South African" },
  { field: "phone", label: "Phone Number", type: "tel", placeholder: "+27 71 234 5678" },
  {
    field: "department",
    label: "Department",
    type: "select",
    options: [
      { value: "prayer_and_worship", label: "Prayer and Worship" },
      { value: "media", label: "Media" },
      { value: "hulk", label: "Hulk" },
      { value: "backbone", label: "Backbone" },
      { value: "training", label: "Training" },
      { value: "project_54", label: "Project 54" },
      { value: "education", label: "Education" },
      { value: "woven", label: "Woven" },
    ],
  },
  // ── Address ──────────────────────────────────────────────
  // address_line_2 stays optional (apartment / unit number).
  // Passport / visa fields are intentionally not enforced here —
  // they only apply to international staff and the gate has no way
  // to express that conditional. The onboarding form handles it.
  { field: "address_line_1", label: "Address Line 1", type: "text", placeholder: "Street address" },
  { field: "city", label: "City", type: "text", placeholder: "e.g. Potchefstroom" },
  { field: "province", label: "Province / State", type: "text", placeholder: "e.g. North West" },
  { field: "country", label: "Country", type: "text", placeholder: "e.g. South Africa" },
  { field: "postal_code", label: "Postal Code", type: "text", placeholder: "e.g. 2520" },
  // ── Emergency contact ────────────────────────────────────
  { field: "emergency_contact_name", label: "Emergency Contact Name", type: "text", placeholder: "Full name" },
  { field: "emergency_contact_phone", label: "Emergency Contact Phone", type: "tel", placeholder: "+27 71 234 5678" },
  { field: "emergency_contact_relationship", label: "Emergency Contact Relationship", type: "text", placeholder: "e.g. Parent, Spouse" },
  // ── Health insurance ─────────────────────────────────────
  { field: "health_insurance_provider", label: "Health Insurance Provider", type: "text", placeholder: "e.g. Discovery Health" },
  { field: "health_insurance_policy_number", label: "Health Insurance Policy Number", type: "text", placeholder: "e.g. 123456789" },
  { field: "health_insurance_expiry_date", label: "Health Insurance Expiry Date", type: "date" },
];

export function getMissingProfileFields(
  profile: Record<string, unknown>
): FieldConfig[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => {
    const value = profile[f.field];
    return value === null || value === undefined || value === "";
  });
}
