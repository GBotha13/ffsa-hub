import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getUserById } from "@/services/users";
import {
  getPermissions,
  getUserPermissions,
  getScopeOptions,
} from "@/services/permissions";
import { getSchoolsManageScopes } from "@/lib/auth/schools-manage-scopes";
import { PermissionManager } from "./permission-manager";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  // Access tiers:
  //   super_admin → full editor (status, job title, all modules, all scopes)
  //   schools.manage holder → restricted editor (only `schools.assignable_as_contact`,
  //     only on the programs they manage)
  //   anyone else → kicked back to dashboard
  const { data: superCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .eq("roles.name", "super_admin")
    .limit(1);
  const isSuperAdmin = (superCheck?.length ?? 0) > 0;

  const manageScopes = isSuperAdmin
    ? { hasGlobal: true, programIds: [] }
    : await getSchoolsManageScopes(supabase, authUser.id);

  const hasAnySchoolsManage =
    manageScopes.hasGlobal || manageScopes.programIds.length > 0;

  if (!isSuperAdmin && !hasAnySchoolsManage) redirect("/dashboard");

  // Load the target user
  const { data: targetUser, error } = await getUserById(supabase, id);
  if (error || !targetUser) notFound();

  // Load all permissions, user's current permissions, and scope options
  const [permissionsByModule, userPermissions, scopeOptions] = await Promise.all([
    getPermissions(supabase),
    getUserPermissions(supabase, id),
    getScopeOptions(supabase),
  ]);

  const name =
    targetUser.display_name ??
    (targetUser.first_name
      ? `${targetUser.preferred_name ?? targetUser.first_name} ${targetUser.last_name}`
      : targetUser.email ?? "Unknown User");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="page-eyebrow">SYSTEM ACCESS</p>
        <h1 className="page-title">{name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {targetUser.email} ·{" "}
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: "4px",
              background:
                targetUser.status === "active"
                  ? "hsl(142 60% 20%)"
                  : targetUser.status === "pending_approval"
                  ? "hsl(42 80% 18%)"
                  : "hsl(22 8% 15%)",
              color:
                targetUser.status === "active"
                  ? "hsl(142 60% 55%)"
                  : targetUser.status === "pending_approval"
                  ? "hsl(42 95% 55%)"
                  : "hsl(30 8% 55%)",
            }}
          >
            {targetUser.status === "active"
              ? "Active"
              : targetUser.status === "pending_approval"
              ? "Pending Approval"
              : "Invited"}
          </span>
        </p>
      </div>

      <PermissionManager
        userId={id}
        currentStatus={targetUser.status ?? "invited"}
        currentJobTitle={targetUser.job_title ?? ""}
        permissionsByModule={permissionsByModule}
        userPermissions={userPermissions}
        scopeOptions={scopeOptions}
        isSuperAdmin={isSuperAdmin}
        managedProgramIds={
          manageScopes.hasGlobal
            ? null // null sentinel = all programs
            : manageScopes.programIds
        }
      />
    </div>
  );
}
