import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";
import { confirmSchedulingSlot } from "@/services/scheduling";

export async function POST(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; requestId: string }> }
) {
  const { enrollmentId, requestId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    slot_id?: string;
    message?: string | null;
  };
  if (!body.slot_id) {
    return NextResponse.json({ error: "slot_id is required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: enrollment } = await adminSupabase
    .from("workflow_enrollments")
    .select(
      "workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(outcome:event_outcomes!outcome_workflows_outcome_id_fkey(event_id))"
    )
    .eq("id", enrollmentId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventId: string | null = (enrollment as any)?.workflow?.outcome?.event_id ?? null;
  if (!eventId) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
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

  const result = await confirmSchedulingSlot(
    adminSupabase,
    requestId,
    body.slot_id,
    authUser.id,
    body.message
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
