import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSendFleetReminder, runFleetReminder } from "@/lib/fleet/reminder-send";

export const maxDuration = 60;

// GET /api/cron/fleet-reminder — daily Vercel cron, 05:00 UTC = 07:00 SAST. Fleet's
// morning reminder to the Vehicle Coordinator by email and Slack DM (SPEC 6.11).
// Nothing is sent when every section is empty, at most once a day (fleet_reminder_sends),
// and only on the live site: anywhere else it just returns what it would have sent.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const run = await runFleetReminder(createAdminClient(), { send: canSendFleetReminder() });
    return NextResponse.json({
      ok: true,
      date: run.date,
      outcome: run.outcome,
      subject: run.reminder.empty ? null : run.reminder.subject,
      results: run.results ?? null,
    });
  } catch (err) {
    console.error("[cron/fleet-reminder] failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
