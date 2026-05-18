import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertContactWithDedup } from "@/services/contact-upsert";
import {
  getCsvImport,
  incrementCsvImportCounters,
} from "@/services/csv-imports";

// Max rows per request — keeps each call inside Vercel's function timeout.
const MAX_BATCH = 250;

type IncomingRow = {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  marital_status?: string | null;
  gender?: string | null;
  nationality?: string | null;
  preferred_language?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postal_code?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  notes?: string | null;
};

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

  const allowed = await isCommsAdmin(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { rows?: IncomingRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }
  if (body.rows.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `rows.length must be ≤ ${MAX_BATCH}` },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  const importRecord = await getCsvImport(adminSupabase, importId);
  if (importRecord.error || !importRecord.data) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const labelId = importRecord.data.label_id;
  const addedVia = `csv:${importId}`;
  const source = `csv:${importRecord.data.filename}`;

  let imported = 0;
  let matched = 0;
  let review = 0;
  let errored = 0;
  const errors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < body.rows.length; i++) {
    const raw = body.rows[i];
    const trimmed = trimRow(raw);
    if (!trimmed.email && !trimmed.phone) {
      errored++;
      errors.push({ index: i, message: "Missing email and phone" });
      continue;
    }

    const result = await upsertContactWithDedup(adminSupabase, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contact: trimmed as any,
      labelId,
      addedVia,
      userId: user.id,
      source,
      reviewSource: { type: "csv", id: importId },
    });

    if (result.error || !result.data) {
      errored++;
      errors.push({
        index: i,
        message:
          (result.error as { message?: string })?.message ?? "Unknown error",
      });
      continue;
    }

    switch (result.data.action) {
      case "created":
        imported++;
        break;
      case "matched":
        matched++;
        break;
      case "queued_for_review":
        review++;
        break;
    }
  }

  await incrementCsvImportCounters(adminSupabase, importId, {
    imported,
    matched,
    review,
    errored,
  });

  return NextResponse.json({
    processed: body.rows.length,
    imported,
    matched,
    review,
    errored,
    errors: errors.slice(0, 20),
  });
}

function trimRow(row: IncomingRow): IncomingRow {
  const out: IncomingRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      (out as Record<string, unknown>)[k] = trimmed === "" ? null : trimmed;
    } else {
      (out as Record<string, unknown>)[k] = v ?? null;
    }
  }
  return out;
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
