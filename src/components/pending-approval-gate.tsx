import { createClient } from "@/lib/supabase/server";
import { Clock } from "lucide-react";

/**
 * Blocks access for users whose account is pending super admin approval.
 * super_admin and admin bypass this gate entirely.
 */
export async function PendingApprovalGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  // Check if current user is super_admin or admin — they always bypass
  const { data: adminCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", user.id)
    .in("roles.name", ["super_admin", "admin"])
    .limit(1);

  if ((adminCheck?.length ?? 0) > 0) return <>{children}</>;

  // Check user status (cast to any — new columns added in migration 014)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("users")
    .select("status, first_name")
    .eq("id", user.id)
    .single() as { data: { status: string; first_name: string | null } | null };

  if (!profile || profile.status !== "pending_approval") return <>{children}</>;

  // Show holding screen
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
      style={{ maxWidth: "480px", margin: "0 auto" }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "14px",
          background: "hsl(42 95% 55% / 0.1)",
          border: "1px solid hsl(42 95% 55% / 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
        }}
      >
        <Clock className="h-6 w-6" style={{ color: "hsl(42 95% 55%)" }} />
      </div>

      <p
        style={{
          fontSize: "9px",
          letterSpacing: "0.3em",
          fontWeight: 700,
          color: "hsl(42 95% 55%)",
          textTransform: "uppercase",
          marginBottom: "8px",
        }}
      >
        Pending Approval
      </p>

      <h2
        style={{
          fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
          fontSize: "2rem",
          letterSpacing: "0.04em",
          color: "#F0EBE3",
          marginBottom: "0.75rem",
        }}
      >
        Account Under Review
      </h2>

      <p style={{ fontSize: "14px", color: "hsl(30 8% 45%)", lineHeight: 1.6 }}>
        {profile.first_name ? `Hi ${profile.first_name} — your` : "Your"} profile
        is complete. A super admin will review your account and assign your access
        shortly. You&apos;ll be able to use the platform once approved.
      </p>
    </div>
  );
}
