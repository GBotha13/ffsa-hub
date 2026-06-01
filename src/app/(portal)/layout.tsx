import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ProfileCompletionGate } from "@/components/profile-completion-gate";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  let userRoles: string[] = [];
  let permittedModules: Set<string> = new Set();

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

      const isAdmin =
        userRoles.includes("super_admin") || userRoles.includes("admin");

      if (!isAdmin) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: permRows } = await (supabase as any)
          .from("user_permissions")
          .select("permissions(module)")
          .eq("user_id", user.id);

        if (permRows) {
          for (const row of permRows as Array<{ permissions: { module: string } | { module: string }[] }>) {
            const perm = Array.isArray(row.permissions)
              ? row.permissions[0]
              : row.permissions;
            if (perm?.module) permittedModules.add(perm.module);
          }
        }
      }
    }
  } catch {
    // fallback to empty roles
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar userRoles={userRoles} permittedModules={permittedModules} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <AutoRefresh />
          <ProfileCompletionGate>{children}</ProfileCompletionGate>
        </div>
      </main>
    </div>
  );
}
