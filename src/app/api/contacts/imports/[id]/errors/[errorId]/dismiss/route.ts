import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markErrorDismissed } from "@/services/csv-import-errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; errorId: string }> }
) {
  const { errorId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isCommsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { note?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const adminSupabase = createAdminClient();
  const result = await markErrorDismissed(adminSupabase, errorId, {
    userId: user.id,
    note: body.note ?? null,
  });
  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error?.message ?? "Dismiss failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

async function isCommsAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "comms_admin"])
    .limit(1);
  return !!data && data.length > 0;
}
