import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanManageApplications } from "@/lib/auth/check-schools-access";

const STAFF_ROLE_NAMES = ["super_admin", "admin", "program_leader", "staff"];

// Returns users eligible to be assigned as point-of-contact staff for
// applications or enrollments. Caller must have schools management access.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const hasAccess = await userCanManageApplications(supabase, authUser.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  const { data: rows, error } = await adminSupabase
    .from("user_roles")
    .select("user_id, roles!inner(name), users!inner(id, first_name, last_name, preferred_name, email, is_active)")
    .in("roles.name", STAFF_ROLE_NAMES);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate (a user with multiple eligible roles appears once) and drop
  // inactive accounts.
  const seen = new Map<
    string,
    {
      id: string;
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      email: string | null;
    }
  >();
  for (const row of (rows ?? []) as Array<{
    user_id: string;
    users:
      | {
          id: string;
          first_name: string | null;
          last_name: string | null;
          preferred_name: string | null;
          email: string | null;
          is_active: boolean | null;
        }
      | null;
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

  const staff = Array.from(seen.values()).sort((a, b) => {
    const an = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim().toLowerCase();
    const bn = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim().toLowerCase();
    return an.localeCompare(bn);
  });

  return NextResponse.json({ staff });
}
