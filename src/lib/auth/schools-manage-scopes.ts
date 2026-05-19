// Helpers around the `schools.manage` permission. A user with this
// permission for a specific program can manage who's assignable as a
// point of contact for that program — including granting/revoking
// `schools.assignable_as_contact` on it.

type Client = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type SchoolsManageScopes = {
  // true if the user has a global (unscoped) schools.manage permission.
  // They can manage assignable-contacts on every program.
  hasGlobal: boolean;
  // The program ids they have schools.manage scoped to (in addition).
  programIds: string[];
};

export async function getSchoolsManageScopes(
  supabase: Client,
  userId: string
): Promise<SchoolsManageScopes> {
  const { data } = await supabase
    .from("user_permissions")
    .select("scope_id, scope_type, permissions!inner(key)")
    .eq("user_id", userId)
    .eq("permissions.key", "schools.manage");

  let hasGlobal = false;
  const programIds: string[] = [];

  for (const row of (data ?? []) as Array<{
    scope_id: string | null;
    scope_type: string | null;
  }>) {
    if (row.scope_id == null) {
      hasGlobal = true;
    } else if (row.scope_type === "program") {
      programIds.push(row.scope_id);
    }
  }

  return { hasGlobal, programIds };
}

// True when the user is allowed to grant/revoke
// `schools.assignable_as_contact` on the given target program.
export function canManageAssignmentsOnProgram(
  scopes: SchoolsManageScopes,
  programId: string | null
): boolean {
  if (!programId) return false;
  if (scopes.hasGlobal) return true;
  return scopes.programIds.includes(programId);
}
