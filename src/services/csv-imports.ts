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

// ────────────────────────────────────────────────────────────
// Rollback
// ────────────────────────────────────────────────────────────

export type RollbackResult = {
  netNewDeleted: number;
  labelsRemoved: number;
};

/**
 * Undo an import: delete every contact this import created, and remove this
 * import's label from contacts that already existed.
 *
 * A contact is "net-new from this import" iff it has a `contact_created`
 * activity event within the import's [created_at, completed_at + 5m] window
 * AND a `csv_imported` event tagged with this import_id. Otherwise it was a
 * pre-existing contact that got enriched + labeled by this import; we leave
 * its data alone and just strip the label.
 *
 * Field-level updates to matched contacts are NOT reverted — the enrich
 * step only fills blank fields, so there's nothing to "unwind" cleanly.
 */
export async function rollbackCsvImport(
  supabase: Client,
  importId: string
): Promise<{ data: RollbackResult | null; error: unknown }> {
  const importQuery = await getCsvImport(supabase, importId);
  if (importQuery.error || !importQuery.data) {
    return { data: null, error: importQuery.error ?? new Error("Import not found") };
  }
  const importRow = importQuery.data as {
    id: string;
    created_at: string;
    completed_at: string | null;
    label_id: string | null;
  };

  // Window for "this contact_created came from this import"
  const windowStart = importRow.created_at;
  const windowEnd = importRow.completed_at
    ? new Date(new Date(importRow.completed_at).getTime() + 5 * 60_000).toISOString()
    : new Date().toISOString();

  // 1. All contacts touched by this import
  const touchedQuery = await supabase
    .from("activity_events")
    .select("contact_id")
    .eq("event_type", "csv_imported")
    .filter("payload->>import_id", "eq", importId);
  if (touchedQuery.error) {
    return { data: null, error: touchedQuery.error };
  }
  const touchedContactIds = Array.from(
    new Set(
      (touchedQuery.data as Array<{ contact_id: string }>).map((r) => r.contact_id)
    )
  );

  if (touchedContactIds.length === 0) {
    await updateCsvImport(supabase, importId, { status: "rolled_back" });
    return { data: { netNewDeleted: 0, labelsRemoved: 0 }, error: null };
  }

  // 2. Of those, which were created BY this import (within the time window)?
  const createdQuery = await supabase
    .from("activity_events")
    .select("contact_id")
    .eq("event_type", "contact_created")
    .in("contact_id", touchedContactIds)
    .gte("occurred_at", windowStart)
    .lte("occurred_at", windowEnd);
  if (createdQuery.error) {
    return { data: null, error: createdQuery.error };
  }
  const netNewIds = Array.from(
    new Set(
      (createdQuery.data as Array<{ contact_id: string }>).map((r) => r.contact_id)
    )
  );
  const matchedIds = touchedContactIds.filter((id) => !netNewIds.includes(id));

  // 3. Delete net-new contacts (FK cascades clean up labels, events, etc.)
  if (netNewIds.length > 0) {
    const deleteResult = await supabase
      .from("contacts")
      .delete()
      .in("id", netNewIds);
    if (deleteResult.error) {
      return { data: null, error: deleteResult.error };
    }
  }

  // 4. Strip this import's label from matched (pre-existing) contacts.
  //    Scope by added_via so we don't yank a label the user manually applied
  //    after the import landed.
  if (matchedIds.length > 0 && importRow.label_id) {
    const labelDelete = await supabase
      .from("contact_labels")
      .delete()
      .in("contact_id", matchedIds)
      .eq("label_id", importRow.label_id)
      .eq("added_via", `csv:${importId}`);
    if (labelDelete.error) {
      return { data: null, error: labelDelete.error };
    }
  }

  await updateCsvImport(supabase, importId, { status: "rolled_back" });

  return {
    data: {
      netNewDeleted: netNewIds.length,
      labelsRemoved: matchedIds.length,
    },
    error: null,
  };
}
