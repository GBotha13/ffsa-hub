import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if the user has access to manage school applications.
 *
 * Mirrors the database `has_schools_access()` helper used by RLS policies:
 *   admin/super_admin role, OR program_leader role, OR `schools.manage` /
 *   `schools.approve_applications` permission.
 */
export async function userCanManageApplications(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  // Check roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "program_leader"])
    .limit(1);

  if (roles && roles.length > 0) return true;

  // Check schools-related permissions
  const { data: perms } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .in("permissions.key", [
      "schools.manage",
      "schools.approve_applications",
      "schools.manage_enrollments",
    ])
    .limit(1);

  return !!perms && perms.length > 0;
}
