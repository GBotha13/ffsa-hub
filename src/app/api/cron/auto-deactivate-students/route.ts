import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// GET /api/cron/auto-deactivate-students — daily Vercel cron (1am UTC).
//
// Deactivates student accounts that have been inactive for 3+ months:
//   - Has the 'student' role
//   - Has NO elevated role (staff/admin/etc.)
//   - is_active = true
//   - No active enrolment (waiting_for_arrival or arrived, not removed)
//   - No enrolment whose billing_courses.end_date is within the last 3 months
//     (grace period — allows returning students who are between courses)
//   - No open application for a current or future program
//   - Has at least one past enrolment (guards newly registered accounts with
//     no history from being swept up)
//
// Reactivation is automatic: createEnrollment() sets is_active = true when
// an admin enrols a deactivated student in a new course.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

const MEMBERSHIP_ONLY_ROLES = ["student", "community_member", "self_service"];
const ACTIVE_ENROLMENT_STATUSES = ["waiting_for_arrival", "arrived"];
const OPEN_APPLICATION_STATUSES = [
  "submitted",
  "waiting_for_references",
  "references_received",
  "interview_scheduled",
  "accepted",
];

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin: Client = createAdminClient();
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]; // YYYY-MM-DD

  // 1. All role IDs that count as "student-only" (membership roles, not elevated)
  const { data: membershipRoleDefs, error: roleErr } = await admin
    .from("roles")
    .select("id, name")
    .in("name", ["student"]); // only 'student' triggers eligibility
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

  const studentRoleIds = (membershipRoleDefs ?? []).map((r: any) => r.id as string);
  if (studentRoleIds.length === 0) return NextResponse.json({ deactivated: 0 });

  // 2. All user_ids that hold the 'student' role
  const { data: studentRoleRows } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role_id", studentRoleIds);

  const studentIds = new Set<string>(
    (studentRoleRows ?? []).map((r: any) => r.user_id as string)
  );
  if (studentIds.size === 0) return NextResponse.json({ deactivated: 0 });

  // 3. All user_ids with an elevated role — exclude these entirely
  const { data: elevatedRoleDefs } = await admin
    .from("roles")
    .select("id")
    .not("name", "in", `(${MEMBERSHIP_ONLY_ROLES.join(",")})`);

  const elevatedRoleIds = (elevatedRoleDefs ?? []).map((r: any) => r.id as string);
  const { data: elevatedRoleRows } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role_id", elevatedRoleIds);

  const elevatedIds = new Set<string>(
    (elevatedRoleRows ?? []).map((r: any) => r.user_id as string)
  );

  // Pure students: student role, no elevated role, currently active
  const pureStudentIds = [...studentIds].filter((id) => !elevatedIds.has(id));
  if (pureStudentIds.length === 0) return NextResponse.json({ deactivated: 0 });

  const { data: activeStudentRows } = await admin
    .from("users")
    .select("id")
    .in("id", pureStudentIds)
    .eq("is_active", true);

  const activeIds = new Set<string>(
    (activeStudentRows ?? []).map((u: any) => u.id as string)
  );
  if (activeIds.size === 0) return NextResponse.json({ deactivated: 0 });

  const candidateIds = [...activeIds];

  // 4. Exclude: currently actively enrolled
  const { data: activeEnrolmentRows } = await admin
    .from("enrollments")
    .select("user_id")
    .in("user_id", candidateIds)
    .in("status", ACTIVE_ENROLMENT_STATUSES)
    .is("removed_at", null);

  const activelyEnrolledIds = new Set<string>(
    (activeEnrolmentRows ?? []).map((e: any) => e.user_id as string)
  );

  // 5. Exclude: enrolled in a program whose billing_courses end_date is within
  //    the 3-month grace window (course ended recently, or hasn't ended yet)
  const { data: recentCourseDefs } = await admin
    .from("billing_courses")
    .select("program_id")
    .gte("end_date", threeMonthsAgo);

  const recentProgramIds = new Set<string>(
    (recentCourseDefs ?? []).map((c: any) => c.program_id as string)
  );

  const { data: recentCourseEnrolmentRows } = await admin
    .from("enrollments")
    .select("user_id")
    .in("user_id", candidateIds)
    .in("program_id", [...recentProgramIds])
    .is("removed_at", null);

  const recentCourseIds = new Set<string>(
    (recentCourseEnrolmentRows ?? []).map((e: any) => e.user_id as string)
  );

  // 6. Exclude: open application for a current or future program
  const { data: futureCourseDefs } = await admin
    .from("billing_courses")
    .select("program_id")
    .or("end_date.is.null,end_date.gte." + new Date().toISOString().split("T")[0]);

  const futureProgramIds = new Set<string>(
    (futureCourseDefs ?? []).map((c: any) => c.program_id as string)
  );

  const { data: openApplicationRows } = await admin
    .from("application_responses")
    .select("user_id")
    .in("user_id", candidateIds)
    .in("status", OPEN_APPLICATION_STATUSES)
    .in("program_id", [...futureProgramIds]);

  const openApplicationIds = new Set<string>(
    (openApplicationRows ?? []).map((a: any) => a.user_id as string)
  );

  // 7. Require: at least one past enrolment (so we don't sweep newly invited
  //    accounts that haven't started yet)
  const { data: anyEnrolmentRows } = await admin
    .from("enrollments")
    .select("user_id")
    .in("user_id", candidateIds);

  const hasAnyEnrolmentIds = new Set<string>(
    (anyEnrolmentRows ?? []).map((e: any) => e.user_id as string)
  );

  // Final set to deactivate
  const toDeactivate = candidateIds.filter(
    (id) =>
      !activelyEnrolledIds.has(id) &&
      !recentCourseIds.has(id) &&
      !openApplicationIds.has(id) &&
      hasAnyEnrolmentIds.has(id)
  );

  if (toDeactivate.length === 0) return NextResponse.json({ deactivated: 0 });

  const { error: updateErr } = await admin
    .from("users")
    .update({ is_active: false })
    .in("id", toDeactivate);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(`[auto-deactivate-students] deactivated ${toDeactivate.length} account(s)`);
  return NextResponse.json({ deactivated: toDeactivate.length });
}
