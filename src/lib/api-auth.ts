// Small auth helpers for API route handlers. Keeps the auth-check
// boilerplate consistent across the CRM / Events route handlers.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function getAuthedUser(supabase: Client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** True if the user holds at least one of the given role names. */
export async function hasAnyRole(
  supabase: Client,
  userId: string,
  roleNames: string[]
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", roleNames)
    .limit(1);
  return !!data && data.length > 0;
}

export const EVENTS_MANAGE_ROLES = ["super_admin", "admin", "events_admin"];
export const COMMS_MANAGE_ROLES = ["super_admin", "admin", "comms_admin"];
