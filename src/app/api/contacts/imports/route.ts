import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCsvImport } from "@/services/csv-imports";
import { findOrCreateLabel } from "@/services/labels";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed = await isCommsAdmin(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    filename?: string;
    rowCount?: number;
    labelId?: string | null;
    customLabelName?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.filename || typeof body.rowCount !== "number" || body.rowCount < 1) {
    return NextResponse.json(
      { error: "filename and rowCount (>=1) are required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Resolve label: either an explicit id or create one from customLabelName.
  let labelId: string | null = body.labelId ?? null;
  let customLabelName: string | null = null;

  if (!labelId && body.customLabelName) {
    const slug = slugify(body.customLabelName);
    const found = await findOrCreateLabel(adminSupabase, {
      slug,
      name: body.customLabelName,
      createdBy: user.id,
    });
    if (found.error || !found.data) {
      return NextResponse.json(
        { error: "Failed to create label" },
        { status: 500 }
      );
    }
    labelId = found.data.id;
    customLabelName = body.customLabelName;
  }

  const created = await createCsvImport(adminSupabase, {
    filename: body.filename,
    row_count: body.rowCount,
    label_id: labelId,
    custom_label_name: customLabelName,
    status: "processing",
    created_by: user.id,
  });

  if (created.error || !created.data) {
    return NextResponse.json(
      { error: created.error?.message ?? "Failed to create import" },
      { status: 500 }
    );
  }

  return NextResponse.json({ import: created.data });
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

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

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}
