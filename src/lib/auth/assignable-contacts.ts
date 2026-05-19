// Shared helper for resolving "who can be assigned as a point of contact"
// for a given program. Used by the staff-pickable API and the program
// detail server component.
//
// Eligibility (hybrid):
//   - User has the dedicated `schools.assignable_as_contact` permission
//     scoped to this program, OR
//   - User has ANY schools.* permission that's either global (scope_id
//     IS NULL) or scoped to this program.
//
// User must also be active.

export const SCHOOLS_PERMISSION_KEYS = [
  "schools.manage",
  "schools.approve_applications",
  "schools.manage_enrollments",
  "schools.view_applications",
  "schools.assignable_as_contact",
] as const;

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
      "user_id, scope_id, scope_type, permissions!inner(module, key), users!user_permissions_user_id_fkey!inner(id, first_name, last_name, preferred_name, email, is_active)"
    )
    .eq("permissions.module", "schools")
    .in("permissions.key", SCHOOLS_PERMISSION_KEYS as unknown as string[])
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
