import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { code, email, password, first_name, last_name } = body as {
    code?: string;
    email?: string;
    password?: string;
    first_name?: string;
    last_name?: string;
  };

  if (!code || !email || !password) {
    return NextResponse.json(
      { error: "code, email, and password are required" },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Validate the code against the singleton settings row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (adminSupabase as any)
    .from("public_signup_settings")
    .select("code, enabled")
    .eq("id", 1)
    .single();

  if (!settings || settings.code !== code) {
    return NextResponse.json(
      { error: "This invite link is no longer valid. Ask a super admin for an updated link." },
      { status: 403 }
    );
  }

  if (!settings.enabled) {
    return NextResponse.json(
      { error: "Public signup is currently disabled. Ask a super admin to invite you directly." },
      { status: 403 }
    );
  }

  const normalisedEmail = email.trim().toLowerCase();

  const { data: existing } = await adminSupabase
    .from("users")
    .select("id")
    .eq("email", normalisedEmail)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try logging in instead." },
      { status: 409 }
    );
  }

  // Create the auth user (email pre-confirmed — they got here via a
  // trusted shareable link, no verification round-trip needed).
  const { data: created, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email: normalisedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
      },
    });

  if (createError || !created?.user?.id) {
    return NextResponse.json(
      { error: createError?.message || "Failed to create account" },
      { status: 500 }
    );
  }

  const newUserId = created.user.id;

  const { error: insertError } = await adminSupabase.from("users").insert({
    id: newUserId,
    email: normalisedEmail,
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() || null,
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
  });

  if (insertError) {
    // Roll back the auth user so the next attempt isn't blocked by a
    // ghost auth row that has no matching public.users record.
    await adminSupabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Failed to create user record: ${insertError.message}` },
      { status: 500 }
    );
  }

  // Assign the default self_service role.
  const { data: selfServiceRole } = await adminSupabase
    .from("roles")
    .select("id")
    .eq("name", "self_service")
    .single();

  if (selfServiceRole) {
    await adminSupabase.from("user_roles").insert({
      user_id: newUserId,
      role_id: selfServiceRole.id,
      assigned_by: newUserId,
    });
  }

  // Records Library auto-match (same behaviour as the email invite flow).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any).rpc("auto_link_library_records_for_user", {
      p_user_id: newUserId,
    });
  } catch {
    // Non-fatal.
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: newUserId,
    action: "create",
    resource_type: "users",
    resource_id: newUserId,
    changes: { email: normalisedEmail, source: "public_signup_link" },
  });

  return NextResponse.json({ success: true, user_id: newUserId });
}
