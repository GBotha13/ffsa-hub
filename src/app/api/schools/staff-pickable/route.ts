import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanManageApplications } from "@/lib/auth/check-schools-access";

// Returns users that a super admin has explicitly flagged as available
// to be assigned as a point of contact (users.is_assignable_contact = true).
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

  // Cast around the auto-generated types until they're regenerated to
  // include the is_assignable_contact column added in migration 053.
  const sb = adminSupabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          eq: (col: string, val: unknown) => {
            order: (col: string) => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
  };

  const { data, error } = await sb
    .from("users")
    .select("id, first_name, last_name, preferred_name, email")
    .eq("is_assignable_contact", true)
    .eq("is_active", true)
    .order("last_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data ?? [] });
}
