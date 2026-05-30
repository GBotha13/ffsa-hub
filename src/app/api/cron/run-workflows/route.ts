import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDueEnrollments } from "@/services/workflows";
import { runEnrollment, type Enrollment } from "@/lib/workflows/runner";

export const maxDuration = 60;

// GET /api/cron/run-workflows — runs on a Vercel cron schedule.
// Resumes every active enrollment whose delay has elapsed
// (next_run_at <= now): runs its next steps, sends due emails,
// re-parks on the next delay or completes. Mirrors the auth +
// batch-drain shape of /api/cron/send-scheduled.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await getDueEnrollments(admin, nowIso, 200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let emails = 0;
  let completed = 0;
  let cancelled = 0;

  for (const enrollment of (due ?? []) as Enrollment[]) {
    const r = await runEnrollment(admin, enrollment);
    processed += 1;
    emails += r.emailsSent;
    if (r.status === "completed") completed += 1;
    if (r.status === "cancelled") cancelled += 1;
  }

  return NextResponse.json({ processed, emails, completed, cancelled });
}
