// Service module for csv_import_errors — the per-row failure log
// for CSV contact imports.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type CsvImportErrorRow = {
  id: string;
  import_id: string;
  row_index: number;
  raw_row: Record<string, unknown>;
  error_message: string;
  error_code: string;
  status: "pending" | "resolved" | "dismissed";
  resolved_contact_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type ErrorCode =
  | "missing_contact_method"
  | "no_valid_identifier"
  | "invalid_phone_format"
  | "invalid_email_format"
  | "duplicate_key"
  | "dedup_query_failed"
  | "db_insert_failed"
  | "transient"
  | "reconstructed_unknown"
  | "unknown";

/**
 * Classify an upsert / DB error message into one of the codes the
 * CHECK constraint allows. Conservative — falls back to 'unknown' or
 * 'db_insert_failed' rather than guessing.
 */
export function classifyError(
  message: string,
  raw: { email?: string | null; phone?: string | null }
): ErrorCode {
  const lc = message.toLowerCase();
  if (!raw.email && !raw.phone) return "missing_contact_method";
  if (lc.includes("at least one of email or phone")) return "no_valid_identifier";
  if (lc.includes("phone_normalized") || lc.includes("phone normalised"))
    return "invalid_phone_format";
  if (lc.includes("email_normalized")) return "invalid_email_format";
  if (
    lc.includes("duplicate key") ||
    lc.includes("unique constraint") ||
    lc.includes("23505")
  )
    return "duplicate_key";
  if (lc.includes("dedup")) return "dedup_query_failed";
  if (
    lc.includes("timeout") ||
    lc.includes("econn") ||
    lc.includes("network") ||
    lc.includes("fetch failed")
  )
    return "transient";
  if (lc.includes("insert") || lc.includes("constraint")) return "db_insert_failed";
  return "unknown";
}

export async function insertImportError(
  supabase: Client,
  args: {
    importId: string;
    rowIndex: number;
    rawRow: Record<string, unknown>;
    errorMessage: string;
    errorCode: ErrorCode;
  }
) {
  return supabase
    .from("csv_import_errors")
    .insert({
      import_id: args.importId,
      row_index: args.rowIndex,
      raw_row: args.rawRow,
      error_message: args.errorMessage,
      error_code: args.errorCode,
      status: "pending",
    })
    .select()
    .single();
}

export async function insertImportErrorsBulk(
  supabase: Client,
  rows: Array<{
    importId: string;
    rowIndex: number;
    rawRow: Record<string, unknown>;
    errorMessage: string;
    errorCode: ErrorCode;
  }>
) {
  if (rows.length === 0) return { data: [], error: null };
  return supabase.from("csv_import_errors").insert(
    rows.map((r) => ({
      import_id: r.importId,
      row_index: r.rowIndex,
      raw_row: r.rawRow,
      error_message: r.errorMessage,
      error_code: r.errorCode,
      status: "pending",
    }))
  );
}

export async function listImportErrors(
  supabase: Client,
  importId: string,
  options?: { status?: "pending" | "resolved" | "dismissed" | "all" }
) {
  let query = supabase
    .from("csv_import_errors")
    .select("*", { count: "exact" })
    .eq("import_id", importId)
    .order("row_index", { ascending: true });
  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  return query;
}

export async function getImportError(supabase: Client, id: string) {
  return supabase.from("csv_import_errors").select("*").eq("id", id).maybeSingle();
}

export async function markErrorResolved(
  supabase: Client,
  id: string,
  args: { contactId: string; userId: string; note?: string | null }
) {
  return supabase
    .from("csv_import_errors")
    .update({
      status: "resolved",
      resolved_contact_id: args.contactId,
      resolved_by: args.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: args.note ?? null,
    })
    .eq("id", id)
    .select()
    .single();
}

export async function markErrorDismissed(
  supabase: Client,
  id: string,
  args: { userId: string; note?: string | null }
) {
  return supabase
    .from("csv_import_errors")
    .update({
      status: "dismissed",
      resolved_by: args.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: args.note ?? null,
    })
    .eq("id", id)
    .select()
    .single();
}

export async function updateImportErrorMessage(
  supabase: Client,
  id: string,
  args: { errorMessage: string; errorCode: ErrorCode }
) {
  return supabase
    .from("csv_import_errors")
    .update({
      error_message: args.errorMessage,
      error_code: args.errorCode,
    })
    .eq("id", id)
    .select()
    .single();
}

export async function countPendingErrorsForImport(
  supabase: Client,
  importId: string
): Promise<number> {
  const { count } = await supabase
    .from("csv_import_errors")
    .select("id", { count: "exact", head: true })
    .eq("import_id", importId)
    .eq("status", "pending");
  return count ?? 0;
}
