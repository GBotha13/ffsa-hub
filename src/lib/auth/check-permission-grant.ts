// Authorization check for grant-permission / revoke-permission endpoints.
// Returns true if the caller is allowed to make the requested change.
//
// Rules:
//   - super_admin can do anything.
//   - A schools.manage holder can grant/revoke ONLY the
//     `schools.assignable_as_contact` permission, scoped to a program
//     they themselves have `schools.manage` on. (Global schools.manage
//     means any program.)

import { getSchoolsManageScopes, canManageAssignmentsOnProgram } from "./schools-manage-scopes";

type Client = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export async function callerCanGrantPermission(
  supabase: Client,
  callerUserId: string,
  permissionId: string,
  scopeType: string | null | undefined,
  scopeId: string | null | undefined
): Promise<boolean> {
  // super_admin shortcut
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", callerUserId)
    .eq("roles.name", "super_admin")
    .limit(1);
  if (roleRows && roleRows.length > 0) return true;

  // Otherwise: only allow grants of schools.assignable_as_contact on a
  // managed program.
  const { data: permRow } = await supabase
    .from("permissions")
    .select("key")
    .eq("id", permissionId)
    .single();
  const permKey = (permRow as { key?: string } | null)?.key;
  if (permKey !== "schools.assignable_as_contact") return false;
  if (scopeType !== "program" || !scopeId) return false;

  const scopes = await getSchoolsManageScopes(supabase, callerUserId);
  return canManageAssignmentsOnProgram(scopes, scopeId);
}
