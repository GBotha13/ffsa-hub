import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";

export async function PUT(
  request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    notes?: string | null;
  };
  const newNotes =
    typeof body.notes === "string" ? body.notes : body.notes === null ? null : "";
  // Normalize: an empty trimmed string is stored as NULL so the
  // "has notes" indicator is honest.
  const normalized =
    newNotes && newNotes.trim().length > 0 ? newNotes : null;

  const adminSupabase = createAdminClient();

  const { data: existing, error: fetchError } = await adminSupabase
    .from("workflow_enrollments")
    .select(
      "id, contact_id, staff_notes, workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(outcome:event_outcomes!outcome_workflows_outcome_id_fkey(event_id))"
    )
    .eq("id", enrollmentId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = existing as any;
  const eventId: string | null = raw?.workflow?.outcome?.event_id ?? null;
  if (!eventId) {
    return NextResponse.json(
      { error: "Enrollment has no associated event" },
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

  const previousNotes: string | null = raw.staff_notes ?? null;
  const changed = previousNotes !== normalized;

  if (!changed) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  const nowIso = new Date().toISOString();
  // Cast to Record so this compiles before the generated Supabase
  // types include the new staff_notes_* columns from migration 079.
  const updates: Record<string, unknown> = {
    staff_notes: normalized,
    staff_notes_updated_at: normalized ? nowIso : null,
    staff_notes_updated_by: normalized ? authUser.id : null,
  };
  const { error: updateError } = await adminSupabase
    .from("workflow_enrollments")
    .update(updates)
    .eq("id", enrollmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await adminSupabase.from("activity_events").insert({
    contact_id: raw.contact_id,
    event_type: "followup_note",
    payload: {
      enrollment_id: enrollmentId,
      action: normalized ? (previousNotes ? "edited" : "created") : "cleared",
    },
    related_user_id: authUser.id,
  });

  return NextResponse.json({
    success: true,
    staff_notes: normalized,
    staff_notes_updated_at: normalized ? nowIso : null,
  });
}
