import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY } from "./assignable-followup-handlers";

// Can the user view/operate on the event follow-up queue at all?
// Admin/super_admin/events_admin always; otherwise they need at least
// one event-scoped grant of `events.assignable_as_followup_handler`.
export async function userCanAccessFollowupQueue(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "events_admin"])
    .limit(1);

  if (roles && roles.length > 0) return true;

  const { data: perms } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .eq("permissions.key", ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY)
    .limit(1);

  return !!perms && perms.length > 0;
}

// Per-event check used by row actions (assign, mark finished, view).
// Admin/super_admin/events_admin pass. Otherwise the user must hold
// the handler permission scoped to THIS event.
export async function userCanHandleFollowupForEvent(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
): Promise<boolean> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "events_admin"])
    .limit(1);

  if (roles && roles.length > 0) return true;

  const { data: perms } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .eq("permissions.key", ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY)
    .eq("scope_type", "event")
    .eq("scope_id", eventId)
    .limit(1);

  return !!perms && perms.length > 0;
}

// Returns the set of event IDs the user is permitted to handle.
// For admins/events_admin this returns null (meaning "all events").
// For other users, returns the set of event IDs they have explicit
// grants on. Used to scope the queue to the user's accessible events.
export async function getAccessibleEventIdsForFollowups(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string> | null> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "events_admin"])
    .limit(1);

  if (roles && roles.length > 0) return null;

  const { data: perms } = await supabase
    .from("user_permissions")
    .select("scope_id, permissions!inner(key)")
    .eq("user_id", userId)
    .eq("permissions.key", ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY)
    .eq("scope_type", "event");

  return new Set(((perms ?? []) as { scope_id: string }[]).map((p) => p.scope_id));
}
