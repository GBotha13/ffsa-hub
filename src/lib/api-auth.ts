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

/** True if the user holds at least one of the given granular permission keys. */
export async function hasAnyPermission(
  supabase: Client,
  userId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const { data } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .in("permissions.key", permissionKeys)
    .limit(1);
  return !!data && data.length > 0;
}

// Roles or granular permissions that allow writing contact data.
export const CONTACTS_WRITE_ROLES = [
  "super_admin",
  "admin",
  "comms_admin",
  "contacts_admin",
];
export const CONTACTS_WRITE_PERMS = [
  "contacts.write",
  "contacts.edit",
  "contacts.create",
];

/**
 * True if the user may write contact data — either via a contacts-capable
 * role or a granular contacts write permission. Mirrors the RLS policy on
 * the contact tables (migration 087) so the admin-client routes and the
 * browser-client (RLS) paths agree.
 */
export async function canWriteContacts(
  supabase: Client,
  userId: string
): Promise<boolean> {
  if (await hasAnyRole(supabase, userId, CONTACTS_WRITE_ROLES)) return true;
  return hasAnyPermission(supabase, userId, CONTACTS_WRITE_PERMS);
}

/**
 * True if the user may manage events — either via a managing role
 * (EVENTS_MANAGE_ROLES) or a granular events permission. Mirrors the events
 * RLS (migration 086). Defaults to the "Create / Edit Events" capability
 * (events.create); pass a different key for registration/attendance routes
 * (e.g. ["events.manage_registrations"], ["events.manage_attendance"]).
 */
export async function canManageEvents(
  supabase: Client,
  userId: string,
  perms: string[] = ["events.create"]
): Promise<boolean> {
  if (await hasAnyRole(supabase, userId, EVENTS_MANAGE_ROLES)) return true;
  return hasAnyPermission(supabase, userId, perms);
}
