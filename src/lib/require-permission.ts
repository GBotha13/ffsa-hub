import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Call at the top of any admin server page to enforce access.
 *
 * super_admin and admin always pass through.
 * Everyone else must have at least one user_permission row for the given module.
 *
 * Usage:
 *   await requireModuleAccess(supabase, userId, "finance");
 */
export async function requireModuleAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  module: string
) {
  // Check super_admin / admin first — always allowed
  const { data: adminCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin"])
    .limit(1);

  if ((adminCheck?.length ?? 0) > 0) return;

  // Check user has at least one permission for this module
  const { data: permCheck } = await supabase
    .from("user_permissions")
    .select("permissions!inner(module)")
    .eq("user_id", userId)
    .eq("permissions.module", module)
    .limit(1);

  if (!permCheck || permCheck.length === 0) {
    redirect("/dashboard");
  }
}
