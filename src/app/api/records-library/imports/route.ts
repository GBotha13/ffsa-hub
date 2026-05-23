import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createImport, type ColumnMapping, type RecordType } from "@/services/records-library";

const RECORD_TYPES: RecordType[] = ["application", "payment", "enrollment", "document"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed = await canManageLibrary(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    filename?: string;
    record_type?: RecordType;
    column_mapping?: ColumnMapping;
    row_count?: number;
    template_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.filename || !body.record_type || !RECORD_TYPES.includes(body.record_type)) {
    return NextResponse.json(
      { error: "filename and a valid record_type are required" },
      { status: 400 }
    );
  }
  if (!body.column_mapping || typeof body.column_mapping !== "object") {
    return NextResponse.json({ error: "column_mapping is required" }, { status: 400 });
  }
  if (typeof body.row_count !== "number" || body.row_count < 1) {
    return NextResponse.json({ error: "row_count (>=1) is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase: any = createAdminClient();
  const created = await createImport(adminSupabase, {
    filename: body.filename,
    record_type: body.record_type,
    template_id: body.template_id ?? null,
    column_mapping: body.column_mapping,
    row_count: body.row_count,
    created_by: user.id,
  });

  if (created.error || !created.data) {
    return NextResponse.json(
      { error: created.error?.message ?? "Failed to create import" },
      { status: 500 }
    );
  }

  // Move to processing immediately so the rows endpoint can pick up from here.
  await adminSupabase
    .from("library_imports")
    .update({ status: "processing" })
    .eq("id", created.data.id);

  return NextResponse.json({ import: created.data });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function canManageLibrary(supabase: any, userId: string): Promise<boolean> {
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin"])
    .limit(1);
  if (rolesData && rolesData.length > 0) return true;

  const { data: permData } = await supabase
    .from("user_permissions")
    .select("permissions!inner(key)")
    .eq("user_id", userId)
    .eq("permissions.key", "records_library.manage")
    .limit(1);
  return !!permData && permData.length > 0;
}
