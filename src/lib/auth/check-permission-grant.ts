// Authorization check for grant-permission / revoke-permission endpoints.
// Returns true if the caller is allowed to make the requested change.
//
// Rules:
//   - `schools.assignable_as_contact` is scoped-only: it must always be
//     granted/revoked with scope_type='program'. A global grant is
//     rejected no matter who the caller is — a user is only assignable
//     as a point of contact for the exact program(s) granted.
//   - super_admin can do anything else.
//   - A schools.manage holder can grant/revoke ONLY
//     `schools.assignable_as_contact`, scoped to a program they
//     themselves have `schools.manage` on. (Global schools.manage
//     means any program.)

import { getSchoolsManageScopes, canManageAssignmentsOnProgram } from "./schools-manage-scopes";

type Client = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const ASSIGNABLE_CONTACT_KEY = "schools.assignable_as_contact";

export async function callerCanGrantPermission(
  supabase: Client,
  callerUserId: string,
  permissionId: string,
  scopeType: string | null | undefined,
  scopeId: string | null | undefined
): Promise<boolean> {
  // Resolve the permission key first.
  const { data: permRow } = await supabase
    .from("permissions")
    .select("key")
    .eq("id", permissionId)
    .single();
  const permKey = (permRow as { key?: string } | null)?.key;

  // schools.assignable_as_contact must always be program-scoped.
  const isAssignableContact = permKey === ASSIGNABLE_CONTACT_KEY;
  if (isAssignableContact && (scopeType !== "program" || !scopeId)) {
    return false;
  }

  // super_admin can grant anything that passed the guard above.
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", callerUserId)
    .eq("roles.name", "super_admin")
    .limit(1);
  if (roleRows && roleRows.length > 0) return true;

  // Non-super-admins: only schools.assignable_as_contact, only on a
  // program they manage.
  if (!isAssignableContact) return false;

  const scopes = await getSchoolsManageScopes(supabase, callerUserId);
  return canManageAssignmentsOnProgram(scopes, scopeId ?? null);
}
