// ────────────────────────────────────────────────────────────
// REQUIRED PROFILE FIELDS — single source of truth
// ────────────────────────────────────────────────────────────
// This list is consumed by:
//   - ProfileCompletionGate: blocks the app until these are filled
//   - lifecycle.ts: derives the "Profile Incomplete" badge on the
//     Users admin table so super admins can see who's stuck
// Add a field here and both surfaces pick it up automatically.

import {
  COUNTRY_OPTIONS,
  NATIONALITY_OPTIONS,
  SA_PROVINCES,
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  INSURANCE_PROVIDERS,
} from "@/lib/profile/options";

export type FieldConfig = {
  field: string;
  label: string;
  // `phone`: country-code dropdown + digits.
  // `select-with-other`: dropdown with an "Other" sentinel that
  //   reveals a follow-up free-text input (used for province /
  //   insurance provider where the curated list might miss someone).
  type:
    | "text"
    | "select"
    | "select-with-other"
    | "date"
    | "tel"
    | "phone";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export const REQUIRED_PROFILE_FIELDS: FieldConfig[] = [
  // ── Personal ─────────────────────────────────────────────
  { field: "first_name", label: "First Name", type: "text", placeholder: "Your first name" },
  { field: "last_name", label: "Last Name", type: "text", placeholder: "Your last name" },
  { field: "gender", label: "Gender", type: "select", options: GENDER_OPTIONS },
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
  { field: "nationality", label: "Nationality", type: "select", options: NATIONALITY_OPTIONS },
  { field: "phone", label: "Phone Number", type: "phone" },
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
  { field: "country", label: "Country", type: "select", options: COUNTRY_OPTIONS },
  { field: "address_line_1", label: "Address Line 1", type: "text", placeholder: "Street address" },
  { field: "city", label: "City", type: "text", placeholder: "e.g. Potchefstroom" },
  { field: "province", label: "Province / State", type: "select-with-other", options: SA_PROVINCES },
  { field: "postal_code", label: "Postal Code", type: "text", placeholder: "e.g. 2520" },
  // ── Emergency contact ────────────────────────────────────
  { field: "emergency_contact_name", label: "Emergency Contact Name", type: "text", placeholder: "Full name" },
  { field: "emergency_contact_phone", label: "Emergency Contact Phone", type: "phone" },
  { field: "emergency_contact_relationship", label: "Emergency Contact Relationship", type: "select", options: RELATIONSHIP_OPTIONS },
  // ── Health insurance ─────────────────────────────────────
  { field: "health_insurance_provider", label: "Health Insurance Provider", type: "select-with-other", options: INSURANCE_PROVIDERS },
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
