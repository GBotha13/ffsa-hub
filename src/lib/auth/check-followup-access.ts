import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY } from "./assignable-followup-handlers";

// Permission keys that grant queue access across all events. Anyone managing
// registrations or attendance is already doing the operational work that
// follow-ups represent, so they see the full queue.
const ALL_EVENTS_FOLLOWUP_KEYS = [
  "events.manage_registrations",
  "events.manage_attendance",
] as const;

// Can the user view/operate on the event follow-up queue at all?
// Admin/super_admin/events_admin always; users with the broad events
// permissions (manage_registrations / manage_attendance) get full-queue
// access too; otherwise they need at least one event-scoped grant of
// `events.assignable_as_followup_handler`.
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
    .in("permissions.key", [
      ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY,
      ...ALL_EVENTS_FOLLOWUP_KEYS,
    ])
    .limit(1);

  return !!perms && perms.length > 0;
}

// Per-event check used by row actions (assign, mark finished, view).
// Admin/super_admin/events_admin pass. Users with the broad events
// permissions (manage_registrations / manage_attendance) also pass for
// any event. Otherwise the user must hold the handler permission scoped
// to THIS event.
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

  const { data: broadPerms } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .in("permissions.key", ALL_EVENTS_FOLLOWUP_KEYS as unknown as string[])
    .limit(1);

  if (broadPerms && broadPerms.length > 0) return true;

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
// Returns null (meaning "all events") for admins/events_admin AND for
// users with the broad events permissions (manage_registrations /
// manage_attendance). For everyone else, returns the set of event IDs
// they have explicit per-event grants on.
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

  const { data: broadPerms } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .in("permissions.key", ALL_EVENTS_FOLLOWUP_KEYS as unknown as string[])
    .limit(1);

  if (broadPerms && broadPerms.length > 0) return null;

  const { data: perms } = await supabase
    .from("user_permissions")
    .select("scope_id, permissions!inner(key)")
    .eq("user_id", userId)
    .eq("permissions.key", ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY)
    .eq("scope_type", "event");

  return new Set(((perms ?? []) as { scope_id: string }[]).map((p) => p.scope_id));
}
