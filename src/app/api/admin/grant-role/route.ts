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
      { error: "This endpoint only grants the super_admin role" },
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

  const { data: targetUser } = await adminSupabase
    .from("users")
    .select("id")
    .eq("id", user_id)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: insertError } = await adminSupabase
    .from("user_roles")
    .upsert(
      {
        user_id,
        role_id: role.id,
        assigned_by: authUser.id,
      },
      { onConflict: "user_id,role_id,scope_type,scope_id", ignoreDuplicates: true }
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "create",
    resource_type: "user_roles",
    resource_id: user_id,
    changes: { role: role_name, granted_to: user_id },
  });

  return NextResponse.json({ success: true });
}
