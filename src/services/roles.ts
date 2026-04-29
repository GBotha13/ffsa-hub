import type { Database, TablesInsert } from "@/types/database";
type UserRoleInsert = TablesInsert<"user_roles">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function getRoles(supabase: Client) {
  return supabase.from("roles").select("*").order("name");
}

export async function getRoleByName(supabase: Client, name: string) {
  return supabase.from("roles").select("*").eq("name", name).single();
}

export async function getUserRoles(supabase: Client, userId: string) {
  return supabase
    .from("user_roles")
    .select("*, roles(*)")
    .eq("user_id", userId);
}

export async function assignRole(supabase: Client, data: UserRoleInsert) {
  return supabase.from("user_roles").insert(data).select("*, roles(*)").single();
}

export async function removeRole(supabase: Client, userRoleId: string) {
  return supabase.from("user_roles").delete().eq("id", userRoleId);
}

export async function hasRole(
  supabase: Client,
  userId: string,
  roleName: string,
  scopeType?: string,
  scopeId?: string
) {
  let query = supabase
    .from("user_roles")
    .select("id, roles!inner(name)")
    .eq("user_id", userId)
    .eq("roles.name", roleName);

  if (scopeType && scopeId) {
    query = query
      .or(`and(scope_type.is.null),and(scope_type.eq.${scopeType},scope_id.eq.${scopeId})`);
  }

  const { data, error } = await query.limit(1);
  return { hasRole: (data?.length ?? 0) > 0, error };
}
