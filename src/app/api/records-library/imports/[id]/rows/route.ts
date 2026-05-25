import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findPersonByEmail,
  createPerson,
  createApplication,
  createPayment,
  createEnrollment,
  createDocument,
  type ColumnMapping,
  type RecordType,
  PERSON_FIELDS,
  coreFieldsForRecordType,
} from "@/services/records-library";

type CsvRow = Record<string, string | null | undefined>;

type Summary = {
  persons_created: number;
  records_created: number;
  auto_linked_count: number;
  queued_count: number;
  error_count: number;
  processed: number;
};

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: importId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase: any = createAdminClient();

  // Load the import record so we know record_type + mapping.
  const { data: importRow, error: importErr } = await adminSupabase
    .from("library_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (importErr || !importRow) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  // Authz — same gate as the create endpoint.
  const allowed = await canManageLibrary(adminSupabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { rows?: CsvRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
  }

  const recordType = importRow.record_type as RecordType;
  const mapping = importRow.column_mapping as ColumnMapping;
  const personCoreFields = new Set<string>(PERSON_FIELDS);
  const recordCoreFields = new Set<string>(coreFieldsForRecordType(recordType));

  const totals: Summary = {
    persons_created: 0,
    records_created: 0,
    auto_linked_count: 0,
    queued_count: 0,
    error_count: 0,
    processed: 0,
  };
  const errors: Array<{ index: number; message: string }> = [];

  const rowsToProcess: CsvRow[] = body.rows;
  for (let i = 0; i < rowsToProcess.length; i++) {
    const raw: CsvRow = rowsToProcess[i];
    totals.processed += 1;

    try {
      // Split the row into typed person fields, typed record fields, and
      // raw_data. We ALWAYS preserve every CSV column in raw_data so the
      // form-response view on /records-library/persons/[id] is a complete
      // picture of the original CSV row — even the columns that were also
      // mapped to typed columns (first_name, email, status, etc.) stay
      // visible there. The typed columns still get populated for dedup /
      // indexing / sortable display elsewhere.
      const personPart: Record<string, unknown> = {};
      const recordPart: Record<string, unknown> = {};
      const rawData: Record<string, unknown> = {};

      for (const [csvCol, value] of Object.entries(raw ?? {}) as Array<[string, string | null | undefined]>) {
        const target = mapping[csvCol];
        const cleaned = normalizeValue(value);

        // Always keep the column in raw_data (complete CSV view).
        if (csvCol) rawData[csvCol] = cleaned;

        // Additionally populate typed columns if this column was mapped.
        if (!target || target === "raw") continue;
        if (personCoreFields.has(target)) {
          personPart[target] = cleaned;
        } else if (recordCoreFields.has(target)) {
          recordPart[target] = cleaned;
        }
      }

      const email =
        typeof personPart.email === "string" ? (personPart.email as string) : null;
      const lastName =
        typeof personPart.last_name === "string"
          ? (personPart.last_name as string)
          : null;

      // 1. Find-or-create the person.
      let personId: string | null = null;
      if (email) {
        const existing = await findPersonByEmail(adminSupabase, email, lastName);
        if (existing.data?.id) personId = existing.data.id;
      }

      if (!personId) {
        const personInsert = {
          email: (personPart.email as string) ?? null,
          first_name: (personPart.first_name as string) ?? null,
          last_name: (personPart.last_name as string) ?? null,
          preferred_name: (personPart.preferred_name as string) ?? null,
          date_of_birth: parseDate(personPart.date_of_birth),
          phone: (personPart.phone as string) ?? null,
          nationality: (personPart.nationality as string) ?? null,
          country: (personPart.country as string) ?? null,
          source_import_id: importId,
          raw_data: rawData,
        };
        const created = await createPerson(adminSupabase, personInsert);
        if (created.error || !created.data) {
          throw new Error(created.error?.message ?? "Failed to create person");
        }
        personId = created.data.id;
        totals.persons_created += 1;
      }

      // 2. Create the typed record on the person.
      const recordBase = {
        person_id: personId!,
        import_id: importId,
        raw_data: rawData,
      };

      let createErr: { message?: string } | null = null;
      if (recordType === "application") {
        const res = await createApplication(adminSupabase, {
          ...recordBase,
          program_name: (recordPart.program_name as string) ?? null,
          cohort: (recordPart.cohort as string) ?? null,
          status: (recordPart.status as string) ?? null,
          submitted_at: parseDate(recordPart.submitted_at),
        });
        createErr = res.error ?? null;
      } else if (recordType === "payment") {
        const res = await createPayment(adminSupabase, {
          ...recordBase,
          amount: parseAmount(recordPart.amount),
          currency: (recordPart.currency as string) ?? null,
          description: (recordPart.description as string) ?? null,
          paid_at: parseDate(recordPart.paid_at),
        });
        createErr = res.error ?? null;
      } else if (recordType === "enrollment") {
        const res = await createEnrollment(adminSupabase, {
          ...recordBase,
          school_name: (recordPart.school_name as string) ?? null,
          program_name: (recordPart.program_name as string) ?? null,
          role: (recordPart.role as string) ?? null,
          start_date: parseDate(recordPart.start_date),
          end_date: parseDate(recordPart.end_date),
        });
        createErr = res.error ?? null;
      } else if (recordType === "document") {
        const res = await createDocument(adminSupabase, {
          ...recordBase,
          doc_type: (recordPart.doc_type as string) ?? null,
          file_url: (recordPart.file_url as string) ?? null,
          identifier: (recordPart.identifier as string) ?? null,
          expires_at: parseDate(recordPart.expires_at),
        });
        createErr = res.error ?? null;
      }

      if (createErr) throw new Error(createErr.message ?? "Failed to create record");
      totals.records_created += 1;
    } catch (err) {
      totals.error_count += 1;
      errors.push({
        index: i,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update aggregates on the import row.
  if (errors.length > 0) {
    await adminSupabase
      .from("library_imports")
      .update({
        error_log: errors,
      })
      .eq("id", importId);
  }

  // Increment counters atomically by reading + writing (small batches, fine).
  const current = await adminSupabase
    .from("library_imports")
    .select("persons_created, records_created, error_count")
    .eq("id", importId)
    .maybeSingle();

  const currentData = current.data as
    | { persons_created: number; records_created: number; error_count: number }
    | null;
  if (currentData) {
    await adminSupabase
      .from("library_imports")
      .update({
        persons_created:
          (currentData.persons_created ?? 0) + totals.persons_created,
        records_created:
          (currentData.records_created ?? 0) + totals.records_created,
        error_count: (currentData.error_count ?? 0) + totals.error_count,
      })
      .eq("id", importId);
  }

  return NextResponse.json(totals);
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function normalizeValue(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return String(v);
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

// Accepts: "8/16/04", "8/16/2004", "2004-08-16", "16/8/2004".
// Heuristic: if the year-component is 2 digits, assume 2000+yy.
function parseDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  // ISO already.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // mm/dd/yy(yy) — assume US ordering for now; raw_data preserves the original.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    let yy = parseInt(m[3], 10);
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    if (m[3].length === 2) yy = yy + 2000;
    if (mm > 12 || dd > 31) return null;
    return `${yy.toString().padStart(4, "0")}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
  }

  // Fallback: try Date.parse.
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function parseAmount(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
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
