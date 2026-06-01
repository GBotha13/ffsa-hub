import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFollowupDetail } from "@/services/event-followup";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";

async function getEnrollmentEventId(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  enrollmentId: string
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("workflow_enrollments")
    .select(
      "workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(outcome:event_outcomes!outcome_workflows_outcome_id_fkey(event_id))"
    )
    .eq("id", enrollmentId)
    .single();
  const eventId = data?.workflow?.outcome?.event_id;
  return typeof eventId === "string" ? eventId : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const eventId = await getEnrollmentEventId(supabase, enrollmentId);
  if (!eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await userCanHandleFollowupForEvent(
    supabase,
    user.id,
    eventId
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const detail = await getFollowupDetail(supabase, enrollmentId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ detail });
}
