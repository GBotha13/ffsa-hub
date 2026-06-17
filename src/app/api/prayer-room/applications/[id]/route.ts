import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignEvaluator, recordEvaluation, decideApplication, getApplicationById } from "@/services/prayer-room-applications";
import { isPrayerRoomStaff, isAssignedEvaluator } from "@/lib/auth/prayer-room-access";
import { sendPrayerRoomEvaluatorAssigned, sendPrayerRoomDecision } from "@/lib/email/send-prayer-room";

const NAME_EMAIL = "id, first_name, last_name, preferred_name, email";

// PUT — pipeline transitions: assign | evaluate | decide.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = (body as { action?: string }).action;
  const admin = createAdminClient();

  if (action === "assign") {
    if (!(await isPrayerRoomStaff(supabase, user.id))) {
      return NextResponse.json({ error: "Only coordinators can assign evaluators" }, { status: 403 });
    }
    const evaluatorId = (body as { evaluator_id?: string }).evaluator_id;
    if (!evaluatorId) return NextResponse.json({ error: "evaluator_id is required" }, { status: 400 });

    const { data, error } = await assignEvaluator(supabase, id, { evaluator_id: evaluatorId, assigned_by: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    // notify the evaluator (best-effort)
    const { data: app } = await getApplicationById(admin, id);
    const { data: evaluator } = await admin.from("users").select(NAME_EMAIL).eq("id", evaluatorId).single();
    if (evaluator && app) {
      await sendPrayerRoomEvaluatorAssigned({
        evaluator,
        applicant: app.applicant ?? {},
        skills: (app.skills ?? []).map((s: { label: { name: string } | null }) => s.label?.name).filter(Boolean),
      });
    }
    return NextResponse.json(data);
  }

  if (action === "evaluate") {
    const allowed = (await isAssignedEvaluator(supabase, user.id, id)) || (await isPrayerRoomStaff(supabase, user.id));
    if (!allowed) return NextResponse.json({ error: "Only the assigned evaluator can evaluate" }, { status: 403 });

    const { data, error } = await recordEvaluation(supabase, {
      application_id: id,
      evaluator_id: user.id,
      notes: (body.notes as string) ?? null,
      met_at: (body.met_at as string) ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json(data);
  }

  if (action === "decide") {
    const allowed = (await isAssignedEvaluator(supabase, user.id, id)) || (await isPrayerRoomStaff(supabase, user.id));
    if (!allowed) return NextResponse.json({ error: "Only the assigned evaluator can decide" }, { status: 403 });

    const approve = (body as { approve?: boolean }).approve === true;
    const { data, error } = await decideApplication(admin, {
      id,
      approve,
      decided_by: user.id,
      decision_note: (body.decision_note as string) ?? null,
    });
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to decide" }, { status: 500 });

    // notify the applicant (best-effort)
    const { data: applicant } = await admin.from("users").select(NAME_EMAIL).eq("id", data.applicant_id).single();
    if (applicant) {
      await sendPrayerRoomDecision({ applicant, approved: approve, note: data.decision_note });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
