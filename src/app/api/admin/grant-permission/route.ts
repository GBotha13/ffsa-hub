import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { grantPermission } from "@/services/permissions";
import { callerCanGrantPermission } from "@/lib/auth/check-permission-grant";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { user_id, permission_id, scope_type, scope_id } = body;

  if (!user_id || !permission_id) {
    return NextResponse.json(
      { error: "user_id and permission_id are required" },
      { status: 400 }
    );
  }

  // Authorization: super_admin can grant anything; a schools.manage holder
  // can grant only `schools.assignable_as_contact` on a program they manage.
  const allowed = await callerCanGrantPermission(
    supabase,
    authUser.id,
    permission_id,
    scope_type,
    scope_id
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await grantPermission(
    supabase,
    user_id,
    permission_id,
    authUser.id,
    scope_type,
    scope_id
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
