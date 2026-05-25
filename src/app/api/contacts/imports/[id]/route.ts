import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCsvImport, rollbackCsvImport } from "@/services/csv-imports";

export async function GET(
  _request: Request,
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
  if (!(await isCommsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();
  const result = await getCsvImport(adminSupabase, importId);
  if (result.error || !result.data) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  return NextResponse.json({ import: result.data });
}

export async function DELETE(
  _request: Request,
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
  if (!(await isCommsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();
  const importQuery = await getCsvImport(adminSupabase, importId);
  if (importQuery.error || !importQuery.data) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  if (importQuery.data.status === "rolled_back") {
    return NextResponse.json(
      { error: "This import has already been rolled back" },
      { status: 400 }
    );
  }

  const result = await rollbackCsvImport(adminSupabase, importId);
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        error:
          (result.error as { message?: string })?.message ?? "Rollback failed",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    rollback: result.data,
  });
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
