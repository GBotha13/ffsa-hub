import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Records a failed sign-in attempt against a KNOWN account so it surfaces on the
// admin "Security activity" card. We only attribute attempts to real users
// (there's nothing to brute-force on a non-existent email), and we cap how many
// we store per window so a flood can't bloat the log. This endpoint never blocks
// a login — it's best-effort logging only; the soft retry slow-down lives on the
// client and Supabase's own rate limits are the real backstop.
const WINDOW_MS = 15 * 60 * 1000;
const STORE_CAP = 10;

export async function POST(request: Request) {
  const neutral = NextResponse.json({ ok: true });

  const body = await request.json().catch(() => ({}));
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return neutral;

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (!user) return neutral;

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("resource_id", user.id)
    .eq("action", "failed_login")
    .gte("created_at", since);

  if ((count ?? 0) >= STORE_CAP) return neutral;

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "failed_login",
    resource_type: "auth",
    resource_id: user.id,
    changes: { email },
  });

  return neutral;
}
