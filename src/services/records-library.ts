// Records Library — pure data-access. Imports CSVs of historical
// staff/student records (applications, payments, enrollments,
// documents), holds them in a library keyed by library_persons,
// and links them to user accounts on signup or by review.
//
// NOTE: This module deliberately uses loose `any` types on the
// Supabase client and the table rows because the new tables are
// added in migrations 060+; once you run
//   supabase gen types typescript --project-id <id> > src/types/database.ts
// you can swap these for TablesInsert<"library_imports"> etc.

/* eslint-disable @typescript-eslint/no-explicit-any */

type Client = any;

export type RecordType = "application" | "payment" | "enrollment" | "document";

export interface ColumnMapping {
  [csvColumn: string]: string; // value = core field name OR "raw"
}

// ────────────────────────────────────────────────────────────
// library_imports
// ────────────────────────────────────────────────────────────

export async function listImports(
  supabase: Client,
  options?: { limit?: number; offset?: number; status?: string }
) {
  let query = supabase
    .from("library_imports")
    .select(
      "*, users:created_by(first_name, last_name, email), library_templates:template_id(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }
  return query;
}

export async function getImport(supabase: Client, id: string) {
  return supabase
    .from("library_imports")
    .select("*, library_templates:template_id(name, column_mapping)")
    .eq("id", id)
    .maybeSingle();
}

export async function createImport(
  supabase: Client,
  data: {
    filename: string;
    record_type: RecordType;
    template_id?: string | null;
    column_mapping: ColumnMapping;
    column_order?: string[];
    row_count: number;
    created_by?: string | null;
  }
) {
  return supabase.from("library_imports").insert(data).select().single();
}

export async function updateImport(
  supabase: Client,
  id: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("library_imports")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function markImportComplete(
  supabase: Client,
  id: string,
  counters: {
    persons_created: number;
    records_created: number;
    auto_linked_count: number;
    queued_count: number;
    error_count: number;
  }
) {
  return updateImport(supabase, id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    ...counters,
  });
}

export async function markImportFailed(
  supabase: Client,
  id: string,
  errorLog: unknown
) {
  return updateImport(supabase, id, {
    status: "failed",
    error_log: errorLog,
    completed_at: new Date().toISOString(),
  });
}

// ────────────────────────────────────────────────────────────
// library_templates
// ────────────────────────────────────────────────────────────

export async function listTemplates(
  supabase: Client,
  options?: { recordType?: RecordType }
) {
  let query = supabase
    .from("library_templates")
    .select("*")
    .order("name", { ascending: true });
  if (options?.recordType) query = query.eq("record_type", options.recordType);
  return query;
}

export async function getTemplate(supabase: Client, id: string) {
  return supabase
    .from("library_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

export async function createTemplate(
  supabase: Client,
  data: {
    name: string;
    record_type: RecordType;
    column_mapping: ColumnMapping;
    created_by?: string | null;
  }
) {
  return supabase.from("library_templates").insert(data).select().single();
}

export async function deleteTemplate(supabase: Client, id: string) {
  return supabase.from("library_templates").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// library_persons
// ────────────────────────────────────────────────────────────

export async function listPersons(
  supabase: Client,
  options?: {
    limit?: number;
    offset?: number;
    /** Free-text — matches first_name, last_name, preferred_name, email, phone */
    search?: string;
    /** Filter by source import id */
    importId?: string;
    /** 'all' (default) | 'linked' | 'unlinked' */
    linkedStatus?: "all" | "linked" | "unlinked";
    /** ISO country name */
    country?: string;
    /** ISO nationality string */
    nationality?: string;
    /** Sort: 'newest' (default) | 'oldest' | 'name' | 'email' */
    sort?: "newest" | "oldest" | "name" | "email";
    /** @deprecated use linkedStatus = 'unlinked' */
    onlyUnlinked?: boolean;
  }
) {
  let query = supabase
    .from("library_persons")
    .select(
      "*, users:linked_user_id(id, first_name, last_name, email), source_import:source_import_id(id, filename)",
      { count: "exact" }
    );

  // Sort
  switch (options?.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "name":
      query = query.order("last_name", { ascending: true, nullsFirst: false });
      break;
    case "email":
      query = query.order("email_normalized", { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  // Linked status (new) takes precedence over the legacy onlyUnlinked.
  if (options?.linkedStatus === "linked") {
    query = query.not("linked_user_id", "is", null);
  } else if (options?.linkedStatus === "unlinked" || options?.onlyUnlinked) {
    query = query.is("linked_user_id", null);
  }
  if (options?.importId) {
    query = query.eq("source_import_id", options.importId);
  }
  if (options?.country) {
    query = query.ilike("country", options.country);
  }
  if (options?.nationality) {
    query = query.ilike("nationality", options.nationality);
  }
  if (options?.search) {
    const s = options.search.replace(/[%,()]/g, "");
    if (s) {
      const like = `%${s}%`;
      query = query.or(
        `first_name.ilike.${like},last_name.ilike.${like},preferred_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`
      );
    }
  }
  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }
  return query;
}

/**
 * Returns the distinct list of values across all library_persons for the
 * supplied column — used to populate the filter dropdowns on the persons
 * browser page (countries, nationalities, etc.).
 */
export async function distinctPersonValues(
  supabase: Client,
  column: "country" | "nationality"
): Promise<string[]> {
  const res = await supabase
    .from("library_persons")
    .select(column)
    .not(column, "is", null)
    .order(column);
  const values = new Set<string>();
  for (const row of (res.data ?? []) as Record<string, string | null>[]) {
    const v = (row[column] ?? "").trim();
    if (v) values.add(v);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export async function getPerson(supabase: Client, id: string) {
  return supabase
    .from("library_persons")
    .select(
      "*, users:linked_user_id(id, first_name, last_name, email), source_import:source_import_id(id, filename, column_order)"
    )
    .eq("id", id)
    .maybeSingle();
}

export async function createPerson(
  supabase: Client,
  data: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
    date_of_birth?: string | null;
    phone?: string | null;
    phone_normalized?: string | null;
    nationality?: string | null;
    country?: string | null;
    source_import_id?: string | null;
    raw_data?: Record<string, unknown>;
  }
) {
  return supabase.from("library_persons").insert(data).select().single();
}

// Find an existing library_person by normalized email (and last
// name as a soft tiebreaker), else null. Used by the CSV importer
// to avoid duplicating persons across CSV rows.
export async function findPersonByEmail(
  supabase: Client,
  email: string,
  lastName?: string | null
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { data: null, error: null };

  // Email is the canonical match key. We used to AND on last_name when one
  // was provided, but that created false misses when the existing row was
  // saved with last_name = NULL (e.g. an earlier import without a Last Name
  // mapping). Today we tolerate a NULL existing last_name OR a matching
  // last_name, but reject if the existing last_name conflicts.
  let query = supabase
    .from("library_persons")
    .select("*")
    .eq("email_normalized", normalized);

  if (lastName) {
    const safe = lastName.replace(/[%,()]/g, "");
    query = query.or(`last_name.is.null,last_name.ilike.${safe}`);
  }
  return query.maybeSingle();
}

// ────────────────────────────────────────────────────────────
// child records — applications / payments / enrollments / docs
// ────────────────────────────────────────────────────────────

export async function createApplication(
  supabase: Client,
  data: {
    person_id: string;
    user_id?: string | null;
    import_id?: string | null;
    program_name?: string | null;
    cohort?: string | null;
    status?: string | null;
    submitted_at?: string | null;
    raw_data?: Record<string, unknown>;
    content_hash?: string | null;
  }
) {
  return supabase.from("library_applications").insert(data).select().single();
}

export async function createPayment(
  supabase: Client,
  data: {
    person_id: string;
    user_id?: string | null;
    import_id?: string | null;
    amount?: number | null;
    currency?: string | null;
    description?: string | null;
    paid_at?: string | null;
    raw_data?: Record<string, unknown>;
    content_hash?: string | null;
  }
) {
  return supabase.from("library_payments").insert(data).select().single();
}

export async function createEnrollment(
  supabase: Client,
  data: {
    person_id: string;
    user_id?: string | null;
    import_id?: string | null;
    school_name?: string | null;
    program_name?: string | null;
    role?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    raw_data?: Record<string, unknown>;
    content_hash?: string | null;
  }
) {
  return supabase.from("library_enrollments").insert(data).select().single();
}

export async function createDocument(
  supabase: Client,
  data: {
    person_id: string;
    user_id?: string | null;
    import_id?: string | null;
    doc_type?: string | null;
    file_url?: string | null;
    identifier?: string | null;
    expires_at?: string | null;
    raw_data?: Record<string, unknown>;
    content_hash?: string | null;
  }
) {
  return supabase.from("library_documents").insert(data).select().single();
}

// ────────────────────────────────────────────────────────────
// Per-import / per-person detail — used by the admin drill-in pages
// ────────────────────────────────────────────────────────────

export async function getRecordsForImport(supabase: Client, importId: string) {
  const personLookup =
    "library_persons:person_id(id, first_name, last_name, preferred_name, email, raw_data)";
  const [apps, payments, enrolls, docs] = await Promise.all([
    supabase
      .from("library_applications")
      .select(`*, ${personLookup}`)
      .eq("import_id", importId)
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_payments")
      .select(`*, ${personLookup}`)
      .eq("import_id", importId)
      .order("paid_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_enrollments")
      .select(`*, ${personLookup}`)
      .eq("import_id", importId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_documents")
      .select(`*, ${personLookup}`)
      .eq("import_id", importId)
      .order("expires_at", { ascending: false, nullsFirst: false }),
  ]);

  const personsRes = await supabase
    .from("library_persons")
    .select(
      "id, first_name, last_name, preferred_name, email, date_of_birth, linked_user_id, raw_data, created_at"
    )
    .eq("source_import_id", importId)
    .order("created_at", { ascending: false });

  return {
    applications: apps.data ?? [],
    payments: payments.data ?? [],
    enrollments: enrolls.data ?? [],
    documents: docs.data ?? [],
    persons: personsRes.data ?? [],
    errors: [apps.error, payments.error, enrolls.error, docs.error, personsRes.error].filter(
      Boolean
    ),
  };
}

export async function getRecordsForPerson(supabase: Client, personId: string) {
  const [apps, payments, enrolls, docs] = await Promise.all([
    supabase
      .from("library_applications")
      .select("*, library_imports:import_id(filename, created_at)")
      .eq("person_id", personId)
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_payments")
      .select("*, library_imports:import_id(filename, created_at)")
      .eq("person_id", personId)
      .order("paid_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_enrollments")
      .select("*, library_imports:import_id(filename, created_at)")
      .eq("person_id", personId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_documents")
      .select("*, library_imports:import_id(filename, created_at)")
      .eq("person_id", personId)
      .order("expires_at", { ascending: false, nullsFirst: false }),
  ]);

  return {
    applications: apps.data ?? [],
    payments: payments.data ?? [],
    enrollments: enrolls.data ?? [],
    documents: docs.data ?? [],
    errors: [apps.error, payments.error, enrolls.error, docs.error].filter(Boolean),
  };
}

// ────────────────────────────────────────────────────────────
// Per-user history — used by the profile "History" tab
// ────────────────────────────────────────────────────────────

export async function getUserHistory(supabase: Client, userId: string) {
  const [apps, payments, enrolls, docs] = await Promise.all([
    supabase
      .from("library_applications")
      .select("*")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_payments")
      .select("*")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_enrollments")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("library_documents")
      .select("*")
      .eq("user_id", userId)
      .order("expires_at", { ascending: false, nullsFirst: false }),
  ]);

  return {
    applications: apps.data ?? [],
    payments: payments.data ?? [],
    enrollments: enrolls.data ?? [],
    documents: docs.data ?? [],
    errors: [apps.error, payments.error, enrolls.error, docs.error].filter(
      Boolean
    ),
  };
}

// ────────────────────────────────────────────────────────────
// Match queue
// ────────────────────────────────────────────────────────────

export async function listMatchQueue(
  supabase: Client,
  options?: { status?: string; limit?: number; offset?: number }
) {
  let query = supabase
    .from("library_match_queue")
    .select(
      `*,
       library_persons:person_id(
         id, email, first_name, last_name, preferred_name, date_of_birth, phone, raw_data
       ),
       users:user_id(
         id, first_name, last_name, email
       )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  query = query.eq("status", options?.status ?? "pending");
  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }
  return query;
}

// ────────────────────────────────────────────────────────────
// RPC wrappers
// ────────────────────────────────────────────────────────────

export async function findMatchesForUser(supabase: Client, userId: string) {
  return supabase.rpc("find_library_matches_for_user", { p_user_id: userId });
}

export async function autoLinkForUser(supabase: Client, userId: string) {
  return supabase.rpc("auto_link_library_records_for_user", {
    p_user_id: userId,
  });
}

export async function approveMatch(
  supabase: Client,
  queueId: string,
  notes?: string
) {
  return supabase.rpc("approve_library_match", {
    p_queue_id: queueId,
    p_notes: notes ?? null,
  });
}

export async function rejectMatch(
  supabase: Client,
  queueId: string,
  notes?: string
) {
  return supabase.rpc("reject_library_match", {
    p_queue_id: queueId,
    p_notes: notes ?? null,
  });
}

export async function manualLinkPerson(
  supabase: Client,
  personId: string,
  userId: string
) {
  return supabase.rpc("manual_link_library_person", {
    p_person_id: personId,
    p_user_id: userId,
  });
}

export async function unlinkPerson(supabase: Client, personId: string) {
  return supabase.rpc("unlink_library_person", { p_person_id: personId });
}

// ────────────────────────────────────────────────────────────
// Core field catalog per record type
// ----------------------------------------------------------
// Used by the column-mapping UI to know which typed fields are
// available for each record type. Anything not mapped to a core
// field falls into raw_data.
// ────────────────────────────────────────────────────────────

export const PERSON_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "preferred_name",
  "date_of_birth",
  "phone",
  "nationality",
  "country",
] as const;

export const APPLICATION_FIELDS = [
  "program_name",
  "cohort",
  "status",
  "submitted_at",
] as const;

export const PAYMENT_FIELDS = [
  "amount",
  "currency",
  "description",
  "paid_at",
] as const;

export const ENROLLMENT_FIELDS = [
  "school_name",
  "program_name",
  "role",
  "start_date",
  "end_date",
] as const;

export const DOCUMENT_FIELDS = [
  "doc_type",
  "file_url",
  "identifier",
  "expires_at",
] as const;

export function coreFieldsForRecordType(rt: RecordType): readonly string[] {
  switch (rt) {
    case "application":
      return APPLICATION_FIELDS;
    case "payment":
      return PAYMENT_FIELDS;
    case "enrollment":
      return ENROLLMENT_FIELDS;
    case "document":
      return DOCUMENT_FIELDS;
  }
}
