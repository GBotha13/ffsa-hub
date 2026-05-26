import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCsvImport } from "@/services/csv-imports";
import { insertImportErrorsBulk } from "@/services/csv-import-errors";
import { normalizeEmail, normalizePhoneE164 } from "@/lib/phone";

const MAX_BATCH = 250;

type ReconstructRow = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * Reconstruct lost per-row error records for an import that ran
 * before per-row error capture existed.
 *
 * For each uploaded CSV row:
 *   - Normalize email + phone
 *   - If a contact already exists matching either → skip
 *   - If the row is already queued in dedup_review_queue or already
 *     logged in csv_import_errors → skip
 *   - Otherwise, log a csv_import_errors row with
 *     error_code='reconstructed_unknown' so it surfaces in the
 *     errors UI for fix-and-retry.
 *
 * Returns { reconstructed, alreadyLanded } counts per batch.
 */
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
  if (!(await isCommsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { rows?: ReconstructRow[]; batchOffset?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "rows must be a non-empty array" },
      { status: 400 }
    );
  }
  if (body.rows.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `rows.length must be ≤ ${MAX_BATCH}` },
      { status: 400 }
    );
  }

  const batchOffset =
    typeof body.batchOffset === "number" && body.batchOffset >= 0
      ? body.batchOffset
      : 0;

  const adminSupabase = createAdminClient();

  const importQuery = await getCsvImport(adminSupabase, importId);
  if (importQuery.error || !importQuery.data) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  // Collect normalized identifiers for the batch up front so we can
  // do bulk lookups (1 query for contacts, 1 for existing errors)
  // instead of N queries.
  const rowsWithKeys = body.rows.map((r, idx) => {
    const trimmed: ReconstructRow = {
      first_name: cleanStr(r.first_name),
      last_name: cleanStr(r.last_name),
      email: cleanStr(r.email),
      phone: cleanStr(r.phone),
    };
    return {
      idx,
      raw: trimmed,
      emailNormalized: normalizeEmail(trimmed.email ?? null),
      phoneNormalized: normalizePhoneE164(trimmed.phone ?? null),
    };
  });

  const emails = Array.from(
    new Set(
      rowsWithKeys
        .map((r) => r.emailNormalized)
        .filter((e): e is string => !!e)
    )
  );
  const phones = Array.from(
    new Set(
      rowsWithKeys
        .map((r) => r.phoneNormalized)
        .filter((p): p is string => !!p)
    )
  );

  // 1. Which of these keys already land in contacts?
  const landedEmails = new Set<string>();
  const landedPhones = new Set<string>();
  if (emails.length > 0) {
    const { data } = await adminSupabase
      .from("contacts")
      .select("email_normalized")
      .in("email_normalized", emails);
    for (const row of (data ?? []) as Array<{ email_normalized: string }>) {
      landedEmails.add(row.email_normalized);
    }
  }
  if (phones.length > 0) {
    const { data } = await adminSupabase
      .from("contacts")
      .select("phone_normalized")
      .in("phone_normalized", phones);
    for (const row of (data ?? []) as Array<{ phone_normalized: string }>) {
      landedPhones.add(row.phone_normalized);
    }
  }

  // 2. Which row_indexes are already logged as errors for this import?
  //    (Prevents double-insert on repeated reconstruction runs.)
  //    csv_import_errors is added by migration 067 and may not be in
  //    the generated DB types yet — cast to `any` to bypass.
  const existingIndexes = new Set<number>();
  const targetIndexes = rowsWithKeys.map((r) => batchOffset + r.idx);
  if (targetIndexes.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (adminSupabase as any)
      .from("csv_import_errors")
      .select("row_index")
      .eq("import_id", importId)
      .in("row_index", targetIndexes);
    for (const row of (data ?? []) as Array<{ row_index: number }>) {
      existingIndexes.add(row.row_index);
    }
  }

  // 3. Walk the batch — anything not landed and not already-logged
  //    is a reconstructed error.
  let alreadyLanded = 0;
  const toInsert: Array<{
    importId: string;
    rowIndex: number;
    rawRow: Record<string, unknown>;
    errorMessage: string;
    errorCode: "reconstructed_unknown";
  }> = [];

  for (const row of rowsWithKeys) {
    const absoluteIndex = batchOffset + row.idx;
    const landed =
      (row.emailNormalized && landedEmails.has(row.emailNormalized)) ||
      (row.phoneNormalized && landedPhones.has(row.phoneNormalized));
    if (landed) {
      alreadyLanded++;
      continue;
    }
    if (existingIndexes.has(absoluteIndex)) {
      continue;
    }
    toInsert.push({
      importId,
      rowIndex: absoluteIndex,
      rawRow: row.raw as unknown as Record<string, unknown>,
      errorMessage:
        "Row not found in contacts after the original import. Original failure reason was not captured.",
      errorCode: "reconstructed_unknown",
    });
  }

  if (toInsert.length > 0) {
    const result = await insertImportErrorsBulk(adminSupabase, toInsert);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message ?? "Failed to log reconstructed errors" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    reconstructed: toInsert.length,
    alreadyLanded,
    skippedExisting: rowsWithKeys.length - toInsert.length - alreadyLanded,
  });
}

function cleanStr(v: string | null | undefined): string | null {
  if (typeof v !== "string") return v ?? null;
  const t = v.trim();
  return t === "" ? null : t;
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
