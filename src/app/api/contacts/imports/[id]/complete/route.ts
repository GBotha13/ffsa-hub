import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markCsvImportComplete, markCsvImportFailed } from "@/services/csv-imports";
import type { Json } from "@/types/database";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: importId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: roleCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", user.id)
    .in("roles.name", ["super_admin", "admin", "comms_admin"])
    .limit(1);
  if (!roleCheck || roleCheck.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { failed?: boolean; errorLog?: Record<string, unknown> | null };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const adminSupabase = createAdminClient();

  const result = body.failed
    ? await markCsvImportFailed(adminSupabase, importId, (body.errorLog ?? {}) as Json)
    : await markCsvImportComplete(adminSupabase, importId);

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error?.message ?? "Failed to mark import" },
      { status: 500 }
    );
  }

  return NextResponse.json({ import: result.data });
}
