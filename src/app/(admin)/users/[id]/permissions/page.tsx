import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getUserById } from "@/services/users";
import {
  getPermissions,
  getUserPermissions,
  getScopeOptions,
} from "@/services/permissions";
import { getSchoolsManageScopes } from "@/lib/auth/schools-manage-scopes";
import { PermissionManager } from "../permission-manager";
import { UserTabs } from "../user-tabs";
import { UserHeader } from "../user-header";

export default async function UserPermissionsPage({
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

  // Same gate as before: super_admin or anyone with schools.manage.
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

  if (!isSuperAdmin && !hasAnySchoolsManage) redirect(`/users/${id}`);

  const { data: targetUser, error } = await getUserById(supabase, id);
  if (error || !targetUser) notFound();

  const [permissionsByModule, userPermissions, scopeOptions, targetSuperCheck] =
    await Promise.all([
      getPermissions(supabase),
      getUserPermissions(supabase, id),
      getScopeOptions(supabase),
      supabase
        .from("user_roles")
        .select("roles!inner(name)")
        .eq("user_id", id)
        .eq("roles.name", "super_admin")
        .limit(1),
    ]);

  const isTargetSuperAdmin = (targetSuperCheck.data?.length ?? 0) > 0;
  const isSelf = authUser.id === id;

  return (
    <div className="space-y-6">
      <UserHeader user={targetUser} eyebrow="ACCESS MANAGEMENT" />
      <UserTabs userId={id} active="permissions" showPermissions={true} />

      <PermissionManager
        userId={id}
        currentStatus={targetUser.status ?? "invited"}
        currentJobTitle={targetUser.job_title ?? ""}
        permissionsByModule={permissionsByModule}
        userPermissions={userPermissions}
        scopeOptions={scopeOptions}
        isSuperAdmin={isSuperAdmin}
        managedProgramIds={
          manageScopes.hasGlobal ? null : manageScopes.programIds
        }
        isTargetSuperAdmin={isTargetSuperAdmin}
        isSelf={isSelf}
      />
    </div>
  );
}
