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
    assigned_staff_id?: string | null;
  };
  const newStaffId = body.assigned_staff_id ?? null;

  const adminSupabase = createAdminClient();

  const { data: existing, error: fetchError } = await adminSupabase
    .from("workflow_enrollments")
    .select(
      "id, contact_id, assigned_staff_id, workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(outcome:event_outcomes!outcome_workflows_outcome_id_fkey(event_id))"
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

  const previousStaffId: string | null = raw.assigned_staff_id ?? null;
  const changed = previousStaffId !== newStaffId;

  const updates: Record<string, unknown> = {
    assigned_staff_id: newStaffId,
    staff_assigned_at: newStaffId ? new Date().toISOString() : null,
    staff_assigned_by: newStaffId ? authUser.id : null,
    // Reset viewed flag so the new assignee sees the row as unread.
    staff_viewed_at: null,
  };

  const { error: updateError } = await adminSupabase
    .from("workflow_enrollments")
    .update(updates)
    .eq("id", enrollmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (changed) {
    await adminSupabase.from("activity_events").insert({
      contact_id: raw.contact_id,
      event_type: "followup_assigned",
      payload: {
        enrollment_id: enrollmentId,
        previous_staff_id: previousStaffId,
        new_staff_id: newStaffId,
      },
      related_user_id: newStaffId,
    });
  }

  return NextResponse.json({ success: true });
}
