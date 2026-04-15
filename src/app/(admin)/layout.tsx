import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ProfileCompletionGate } from "@/components/profile-completion-gate";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Load the current user's role names server-side
  let userRoles: string[] = [];
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", user.id);

      if (roleRows) {
        userRoles = roleRows
          .map((r) => {
            const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
            return role?.name ?? null;
          })
          .filter(Boolean) as string[];
      }
    }
  } catch {
    // If roles can't be loaded, sidebar falls back to no module access
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar userRoles={userRoles} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-8">
            <ProfileCompletionGate>{children}</ProfileCompletionGate>
          </div>
      </main>
    </div>
  );
}
