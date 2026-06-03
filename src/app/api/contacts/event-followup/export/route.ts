import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";
import { getEventFollowupExport } from "@/services/event-followup";

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
  const result = await getEventFollowupExport(adminSupabase, eventId);
  if (!result) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const headers = [
    "Event",
    "First Name",
    "Last Name",
    "Preferred Name",
    "Email",
    "Phone",
    "Outcome",
    "Workflow",
    "Status",
    "Stage",
    "Step",
    "Total Steps",
    "Days In Pipeline",
    "Enrolled At",
    "Completed At",
    "Marked Finished At",
    "Assigned Staff",
    "Assigned Staff Email",
    "Staff Notes",
    "Staff Notes Updated At",
  ];

  const lines = [headers.map(escapeCsvValue).join(",")];

  for (const r of result.rows) {
    const row = [
      r.event_title,
      r.contact_first_name ?? "",
      r.contact_last_name ?? "",
      r.contact_preferred_name ?? "",
      r.contact_email ?? "",
      r.contact_phone ?? "",
      r.outcome_name,
      r.workflow_name,
      r.status,
      r.stage_label,
      String(r.steps_done),
      String(r.total_steps),
      String(r.days_in_pipeline),
      formatDate(r.enrolled_at),
      formatDate(r.completed_at),
      formatDate(r.marked_finished_at),
      r.assigned_staff_name ?? "",
      r.assigned_staff_email ?? "",
      r.staff_notes ?? "",
      formatDate(r.staff_notes_updated_at),
    ];
    lines.push(row.map(escapeCsvValue).join(","));
  }

  const csv = lines.join("\n");
  const filename = `event-followup-${slugify(result.eventTitle) || "event"}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
