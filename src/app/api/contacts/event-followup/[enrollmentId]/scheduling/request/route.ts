import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCanHandleFollowupForEvent } from "@/lib/auth/check-followup-access";
import { createSchedulingRequest } from "@/services/scheduling";

export async function POST(
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
    duration_minutes?: number;
    message?: string | null;
    expiry_days?: number;
  };

  const adminSupabase = createAdminClient();

  const { data: enrollment } = await adminSupabase
    .from("workflow_enrollments")
    .select(
      "id, contact_id, workflow:outcome_workflows!workflow_enrollments_workflow_id_fkey(outcome:event_outcomes!outcome_workflows_outcome_id_fkey(event_id))"
    )
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = enrollment as any;
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

  const result = await createSchedulingRequest(adminSupabase, {
    contactId: raw.contact_id,
    requestedBy: authUser.id,
    enrollmentId,
    durationMinutes: body.duration_minutes,
    message: body.message,
    expiryDays: body.expiry_days,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    request: result.request,
    magicLink: result.magicLink,
    emailError: result.emailError,
  });
}
