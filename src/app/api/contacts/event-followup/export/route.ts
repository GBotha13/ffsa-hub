import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";
import {
  getEventFollowupExport,
  type EventFollowupExportRow,
} from "@/services/event-followup";
import {
  EXPORT_COLUMN_LABELS,
  parseExportColumns,
  type ExportColumnKey,
} from "@/lib/event-followup/export-columns";

// Value extractor for every scalar column (form_answers + staff_notes expand
// dynamically and are handled separately).
const SCALAR_VALUE: Record<
  Exclude<ExportColumnKey, "form_answers" | "staff_notes">,
  (r: EventFollowupExportRow) => string
> = {
  event: (r) => r.event_title,
  first_name: (r) => r.contact_first_name ?? "",
  last_name: (r) => r.contact_last_name ?? "",
  preferred_name: (r) => r.contact_preferred_name ?? "",
  email: (r) => r.contact_email ?? "",
  phone: (r) => r.contact_phone ?? "",
  outcome: (r) => r.outcome_name,
  workflow: (r) => r.workflow_name,
  status: (r) => r.status,
  stage: (r) => r.stage_label,
  step: (r) => String(r.steps_done),
  total_steps: (r) => String(r.total_steps),
  days_in_pipeline: (r) => String(r.days_in_pipeline),
  enrolled_at: (r) => formatDate(r.enrolled_at),
  completed_at: (r) => formatDate(r.completed_at),
  marked_finished_at: (r) => formatDate(r.marked_finished_at),
  assigned_staff: (r) => r.assigned_staff_name ?? "",
  assigned_staff_email: (r) => r.assigned_staff_email ?? "",
};

function escapeCsvValue(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id is required" },
      { status: 400 }
    );
  }
  const outcomeId = searchParams.get("outcome_id");
  const selectedColumns = parseExportColumns(searchParams.get("columns"));

  const allowed = await userCanHandleFollowupForEvent(
    supabase,
    authUser.id,
    eventId
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Service-role read so we can return finished/cancelled rows too,
  // which RLS may scope down for non-admins.
  const adminSupabase = createAdminClient();
  const result = await getEventFollowupExport(adminSupabase, eventId, {
    outcomeId,
  });
  if (!result) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Build the CSV from the SELECTED columns, in canonical order. With nothing
  // deselected this is identical to the historical output. The two "group"
  // columns expand: form_answers → one column per unique signup question (so
  // staff get every answer — dropdowns, multiselects, consent acks, the lot),
  // staff_notes → "Staff Notes" + "Staff Notes Updated At".
  const headers: string[] = [];
  for (const key of selectedColumns) {
    if (key === "form_answers") headers.push(...result.formAnswerColumns);
    else if (key === "staff_notes")
      headers.push("Staff Notes", "Staff Notes Updated At");
    else headers.push(EXPORT_COLUMN_LABELS[key]);
  }

  const lines = [headers.map(escapeCsvValue).join(",")];

  for (const r of result.rows) {
    const cells: string[] = [];
    for (const key of selectedColumns) {
      if (key === "form_answers") {
        cells.push(
          ...result.formAnswerColumns.map((label) => r.form_answers[label] ?? "")
        );
      } else if (key === "staff_notes") {
        cells.push(r.staff_notes ?? "", formatDate(r.staff_notes_updated_at));
      } else {
        cells.push(SCALAR_VALUE[key](r));
      }
    }
    lines.push(cells.map(escapeCsvValue).join(","));
  }

  const csv = lines.join("\n");
  const outcomeSlug =
    outcomeId && result.rows[0]?.outcome_name
      ? `-${slugify(result.rows[0].outcome_name)}`
      : "";
  const filename = `event-followup-${slugify(result.eventTitle) || "event"}${outcomeSlug}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
