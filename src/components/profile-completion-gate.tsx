import { createClient } from "@/lib/supabase/server";
import { ProfileCompletionForm } from "./profile-completion-form";

// ────────────────────────────────────────────────────────────
// REQUIRED PROFILE FIELDS
// ────────────────────────────────────────────────────────────
// To require a new field: just add an entry here.
// The gate will automatically prompt users who are missing it.
// ────────────────────────────────────────────────────────────

export type FieldConfig = {
  field: string;
  label: string;
  type: "text" | "select" | "date" | "tel";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

const REQUIRED_PROFILE_FIELDS: FieldConfig[] = [
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
];

export async function ProfileCompletionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in — let the page render (middleware handles redirects)
  if (!user) return <>{children}</>;

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // No profile record yet (still in onboarding) — don't block
  if (!profile) return <>{children}</>;

  // NOTE: we used to bail when `accepted_at` was null on the assumption
  // that the user was still being shepherded through /onboarding. But
  // the onboarding page lives in the (auth) route group with no layout,
  // so the gate is not mounted there — the bail can only mis-fire for
  // seeded super admins (created directly in the DB, never went through
  // onboarding), leaving their required-field collection silently
  // skipped. Always gate; if onboarding ever wraps gate-bearing routes,
  // re-add the check there.

  // Check which required fields are missing
  const missingFields = REQUIRED_PROFILE_FIELDS.filter((f) => {
    const value = (profile as Record<string, unknown>)[f.field];
    return value === null || value === undefined || value === "";
  });

  // All good — render the page
  if (missingFields.length === 0) return <>{children}</>;

  // Missing fields — show the completion form over the page
  return (
    <div className="relative">
      {/* Blurred background */}
      <div className="pointer-events-none blur-sm opacity-50 select-none" aria-hidden>
        {children}
      </div>

      {/* Blocking overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <ProfileCompletionForm missingFields={missingFields} />
      </div>
    </div>
  );
}
