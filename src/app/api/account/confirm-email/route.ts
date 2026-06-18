import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEmailChangeToken } from "@/lib/tokens/email-change";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";

  const result = verifyEmailChangeToken(token);
  if (!result.valid || !result.userId || !result.newEmail) {
    return NextResponse.json(
      { error: "This link is invalid or has expired." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Guard against the address being claimed by someone else in the meantime.
  const { data: taken } = await admin
    .from("users")
    .select("id")
    .ilike("email", result.newEmail)
    .neq("id", result.userId)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      { error: "That email is now in use by another account." },
      { status: 409 }
    );
  }

  // Update the auth identity, then mirror it onto the app users row.
  const { error: authErr } = await admin.auth.admin.updateUserById(result.userId, {
    email: result.newEmail,
    email_confirm: true,
  });
  if (authErr) {
    return NextResponse.json(
      { error: "Couldn't update your email. It may already be in use." },
      { status: 409 }
    );
  }

  await admin.from("users").update({ email: result.newEmail }).eq("id", result.userId);

  await admin.from("audit_logs").insert({
    user_id: result.userId,
    action: "email_changed",
    resource_type: "users",
    resource_id: result.userId,
    changes: { to: result.newEmail },
  });

  return NextResponse.json({ ok: true, email: result.newEmail });
}
