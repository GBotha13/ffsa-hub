import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTemplate,
  type ColumnMapping,
  type RecordType,
} from "@/services/records-library";

const RECORD_TYPES: RecordType[] = ["application", "payment", "enrollment", "document"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { name?: string; record_type?: RecordType; column_mapping?: ColumnMapping };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || !body.record_type || !RECORD_TYPES.includes(body.record_type)) {
    return NextResponse.json(
      { error: "name and a valid record_type are required" },
      { status: 400 }
    );
  }
  if (!body.column_mapping || typeof body.column_mapping !== "object") {
    return NextResponse.json({ error: "column_mapping is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase: any = createAdminClient();
  const res = await createTemplate(adminSupabase, {
    name: body.name,
    record_type: body.record_type,
    column_mapping: body.column_mapping,
    created_by: user.id,
  });

  if (res.error || !res.data) {
    return NextResponse.json(
      { error: res.error?.message ?? "Failed to save template" },
      { status: 500 }
    );
  }
  return NextResponse.json({ template: res.data });
}
