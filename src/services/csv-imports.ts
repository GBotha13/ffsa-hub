import type { Json, TablesInsert, TablesUpdate } from "@/types/database";

type CsvImportInsert = TablesInsert<"csv_imports">;
type CsvImportUpdate = TablesUpdate<"csv_imports">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// CSV imports
// ────────────────────────────────────────────────────────────

export async function listCsvImports(
  supabase: Client,
  options?: { limit?: number; offset?: number; status?: string }
) {
  let query = supabase
    .from("csv_imports")
    .select("*, labels(slug, name), users:created_by(first_name, last_name, email)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}

export async function getCsvImport(supabase: Client, id: string) {
  return supabase
    .from("csv_imports")
    .select("*, labels(slug, name)")
    .eq("id", id)
    .maybeSingle();
}

export async function createCsvImport(supabase: Client, data: CsvImportInsert) {
  return supabase.from("csv_imports").insert(data).select().single();
}

export async function updateCsvImport(
  supabase: Client,
  id: string,
  data: CsvImportUpdate
) {
  return supabase.from("csv_imports").update(data).eq("id", id).select().single();
}

export async function incrementCsvImportCounters(
  supabase: Client,
  id: string,
  delta: { imported?: number; matched?: number; review?: number; errored?: number }
) {
  // Read current values, then write — simpler than a custom RPC and
  // safe enough for serialized batch processing.
  const current = await getCsvImport(supabase, id);
  if (current.error || !current.data) return current;
  const row = current.data;

  return updateCsvImport(supabase, id, {
    imported_count: row.imported_count + (delta.imported ?? 0),
    matched_count: row.matched_count + (delta.matched ?? 0),
    review_count: row.review_count + (delta.review ?? 0),
    error_count: row.error_count + (delta.errored ?? 0),
  });
}

export async function markCsvImportComplete(supabase: Client, id: string) {
  return updateCsvImport(supabase, id, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
}

export async function markCsvImportFailed(
  supabase: Client,
  id: string,
  errorLog: Json
) {
  return updateCsvImport(supabase, id, {
    status: "failed",
    error_log: errorLog,
    completed_at: new Date().toISOString(),
  });
}
