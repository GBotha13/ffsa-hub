import { createClient } from "@/lib/supabase/server";
import { ProfileCompletionForm } from "./profile-completion-form";
import { getMissingProfileFields } from "@/lib/users/profile-fields";

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
  const missingFields = getMissingProfileFields(profile as Record<string, unknown>);

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
