// Shared helper for resolving "who can be assigned as a point of contact"
// for a given program. Used by the staff-pickable API and the program
// detail server component.
//
// Eligibility: the user must have been EXPLICITLY granted the dedicated
// `schools.assignable_as_contact` permission — either globally (scope_id
// IS NULL → assignable for every program) or scoped to this program.
// Holding other schools permissions (manage, approve_applications, etc.)
// does NOT make someone assignable; that's deliberate so the picker only
// contains people a school admin has actively opted in.
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
    .or(`scope_id.is.null,scope_id.eq.${programId}`);

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
