import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { grantPermission } from "@/services/permissions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Only super_admin can grant permissions
  const { data: superCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .eq("roles.name", "super_admin")
    .limit(1);

  if (!superCheck || superCheck.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, permission_id, scope_type, scope_id } = body;

  if (!user_id || !permission_id) {
    return NextResponse.json(
      { error: "user_id and permission_id are required" },
      { status: 400 }
    );
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
