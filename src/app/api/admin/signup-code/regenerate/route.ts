import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

function generateCode(): string {
  // 18 random bytes → 24-char base64url string (no padding).
  return randomBytes(18).toString("base64url");
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: superCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .eq("roles.name", "super_admin")
    .limit(1);

  if (!superCheck || superCheck.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const newCode = generateCode();
  const adminSupabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminSupabase as any)
    .from("public_signup_settings")
    .update({
      code: newCode,
      regenerated_at: new Date().toISOString(),
      regenerated_by: authUser.id,
    })
    .eq("id", 1)
    .select("code, enabled, regenerated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "update",
    resource_type: "public_signup_settings",
    resource_id: "singleton",
    changes: { code_rotated: true },
  });

  return NextResponse.json(data);
}
