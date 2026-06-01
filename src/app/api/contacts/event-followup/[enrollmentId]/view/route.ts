import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";

export async function PUT(
  _request: Request,
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

  const adminSupabase = createAdminClient();

  const { data: existing, error: fetchError } = await adminSupabase
    .from("workflow_enrollments")
    .select(
      "id, assigned_staff_id, workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(outcome:event_outcomes!outcome_workflows_outcome_id_fkey(event_id))"
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

  // Only the assignee themselves should mark the row as viewed; others
  // viewing it shouldn't clear the unread flag for whoever owns it.
  if (raw.assigned_staff_id !== authUser.id) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const updates: Record<string, unknown> = {
    staff_viewed_at: new Date().toISOString(),
  };
  const { error: updateError } = await adminSupabase
    .from("workflow_enrollments")
    .update(updates)
    .eq("id", enrollmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
