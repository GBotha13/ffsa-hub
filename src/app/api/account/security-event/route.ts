import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lets an authenticated page record a security event about ITSELF (the current
// user) into audit_logs, so client-side actions like a successful password
// change show up on the admin "Security activity" card. Strictly whitelisted.
const ALLOWED = new Set(["password_changed"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Silent no-op if there's no session — this is best-effort logging.
  if (!user) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action,
    resource_type: "auth",
    resource_id: user.id,
    changes: null,
  });
  return NextResponse.json({ ok: true });
}
