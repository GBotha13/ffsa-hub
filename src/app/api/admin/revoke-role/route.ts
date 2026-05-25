import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .eq("roles.name", "super_admin")
    .limit(1);

  if (!callerCheck || callerCheck.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, role_name } = body;

  if (!user_id || !role_name) {
    return NextResponse.json(
      { error: "user_id and role_name are required" },
      { status: 400 }
    );
  }

  if (role_name !== "super_admin") {
    return NextResponse.json(
      { error: "This endpoint only revokes the super_admin role" },
      { status: 400 }
    );
  }

  if (user_id === authUser.id) {
    return NextResponse.json(
      { error: "You cannot remove your own super_admin role" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  const { data: role, error: roleError } = await adminSupabase
    .from("roles")
    .select("id")
    .eq("name", role_name)
    .single();

  if (roleError || !role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const { count: superAdminCount } = await adminSupabase
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role_id", role.id);

  if ((superAdminCount ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last super_admin" },
      { status: 400 }
    );
  }

  const { error: deleteError } = await adminSupabase
    .from("user_roles")
    .delete()
    .eq("user_id", user_id)
    .eq("role_id", role.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "delete",
    resource_type: "user_roles",
    resource_id: user_id,
    changes: { role: role_name, revoked_from: user_id },
  });

  return NextResponse.json({ success: true });
}
