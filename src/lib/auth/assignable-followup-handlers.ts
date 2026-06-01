// Shared helper for resolving "who can be assigned to a follow-up"
// for a given event. Mirrors assignable-contacts.ts for the schools
// module (migration 055 / migration 073).
//
// Eligibility: user must have been EXPLICITLY granted the dedicated
// `events.assignable_as_followup_handler` permission SCOPED TO THIS
// EXACT EVENT. The permission is always event-scoped — a grant for
// event A makes the user assignable for event A only. Other events
// permissions do NOT make someone assignable.

export const ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY =
  "events.assignable_as_followup_handler";

type AdminClient = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type AssignableFollowupHandler = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
};

export async function fetchAssignableFollowupHandlers(
  adminSupabase: AdminClient,
  eventId: string
): Promise<AssignableFollowupHandler[]> {
  const { data: rows } = await adminSupabase
    .from("user_permissions")
    .select(
      "user_id, scope_id, scope_type, permissions!inner(key), users!user_permissions_user_id_fkey!inner(id, first_name, last_name, preferred_name, email, is_active)"
    )
    .eq("permissions.key", ASSIGNABLE_FOLLOWUP_HANDLER_PERMISSION_KEY)
    .eq("scope_type", "event")
    .eq("scope_id", eventId);

  const seen = new Map<string, AssignableFollowupHandler>();
  for (const row of (rows ?? []) as Array<{
    user_id: string;
    users: AssignableFollowupHandler & { is_active: boolean | null };
  }>) {
    const u = row.users;
    if (!u || u.is_active === false) continue;
    if (!seen.has(u.id)) {
      seen.set(u.id, {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        preferred_name: u.preferred_name,
        email: u.email,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    `${a.first_name ?? ""} ${a.last_name ?? ""}`
      .toLowerCase()
      .localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase())
  );
}
