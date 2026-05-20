// Shared helper for resolving "who can be assigned as a point of contact"
// for a given program. Used by the staff-pickable API and the program
// detail server component.
//
// Eligibility: the user must have been EXPLICITLY granted the dedicated
// `schools.assignable_as_contact` permission SCOPED TO THIS EXACT PROGRAM.
// The permission is always program-scoped — a grant for program A makes
// the user assignable for program A only, never for other programs.
// Holding other schools permissions (manage, approve_applications, etc.)
// does NOT make someone assignable.
//
// User must also be active.

export const ASSIGNABLE_CONTACT_PERMISSION_KEY = "schools.assignable_as_contact";

type AdminClient = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type AssignableContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
};

export async function fetchAssignableContacts(
  adminSupabase: AdminClient,
  programId: string
): Promise<AssignableContact[]> {
  const { data: rows } = await adminSupabase
    .from("user_permissions")
    .select(
      "user_id, scope_id, scope_type, permissions!inner(key), users!user_permissions_user_id_fkey!inner(id, first_name, last_name, preferred_name, email, is_active)"
    )
    .eq("permissions.key", ASSIGNABLE_CONTACT_PERMISSION_KEY)
    .eq("scope_type", "program")
    .eq("scope_id", programId);

  const seen = new Map<string, AssignableContact>();
  for (const row of (rows ?? []) as Array<{
    user_id: string;
    users: AssignableContact & { is_active: boolean | null };
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
