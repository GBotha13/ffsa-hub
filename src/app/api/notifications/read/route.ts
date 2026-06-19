import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/api-auth";
import { markNotificationsRead } from "@/services/notifications";

// POST /api/notifications/read — mark notification keys as read for this user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { keys?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const keys = Array.isArray(body.keys)
    ? body.keys.filter((k): k is string => typeof k === "string").slice(0, 200)
    : [];
  if (keys.length === 0) return NextResponse.json({ ok: true });

  const { error } = await markNotificationsRead(supabase, user.id, keys);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
