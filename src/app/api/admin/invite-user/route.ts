import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  // Verify the calling user is an admin
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check admin role
  const { data: adminCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .in("roles.name", ["super_admin"])
    .limit(1);

  if (!adminCheck || adminCheck.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { email, first_name, last_name } = body;

  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Check if a user with this email already exists
  const { data: existingUser } = await adminSupabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data: newAuthUser, error: authError } =
    await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
    });

  if (authError) {
    return NextResponse.json(
      { error: authError.message },
      { status: 500 }
    );
  }

  if (!newAuthUser?.user) {
    return NextResponse.json(
      { error: "Failed to create auth user" },
      { status: 500 }
    );
  }

  // Create app-level user record
  const { error: userError } = await adminSupabase.from("users").insert({
    id: newAuthUser.user.id,
    email: email,
    first_name: first_name || null,
    last_name: last_name || null,
    invited_at: new Date().toISOString(),
  });

  if (userError) {
    // Attempt to clean up the auth user if app-level creation fails
    await adminSupabase.auth.admin.deleteUser(newAuthUser.user.id);
    return NextResponse.json(
      { error: `Failed to create user record: ${userError.message}` },
      { status: 500 }
    );
  }

  // Assign default self_service role
  const { data: selfServiceRole } = await adminSupabase
    .from("roles")
    .select("id")
    .eq("name", "self_service")
    .single();

  if (selfServiceRole) {
    await adminSupabase.from("user_roles").insert({
      user_id: newAuthUser.user.id,
      role_id: selfServiceRole.id,
      assigned_by: authUser.id,
    });
  }

  // Audit log
  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "create",
    resource_type: "users",
    resource_id: newAuthUser.user.id,
    changes: { email, first_name, last_name },
  });

  return NextResponse.json({
    success: true,
    user_id: newAuthUser.user.id,
  });
}
