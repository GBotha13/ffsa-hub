import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignBatch } from "@/services/campaign-send";

export const maxDuration = 60;

// GET /api/cron/send-scheduled — runs on a Vercel cron schedule.
// Sends one batch for every campaign that is due (status 'scheduled'
// with scheduled_at in the past) or already 'sending' (resume). Large
// campaigns drain over successive cron runs.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const [{ data: due }, { data: inProgress }] = await Promise.all([
    admin
      .from("campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", nowIso),
    admin.from("campaigns").select("id").eq("status", "sending"),
  ]);

  const ids = Array.from(
    new Set([
      ...(due ?? []).map((c: { id: string }) => c.id),
      ...(inProgress ?? []).map((c: { id: string }) => c.id),
    ])
  );

  const results: Array<{ id: string; sent: number; failed: number; done: boolean }> =
    [];
  for (const id of ids) {
    const r = await sendCampaignBatch(admin, id, 100);
    results.push({ id, sent: r.sent, failed: r.failed, done: r.done });
  }

  return NextResponse.json({ processed: results.length, results });
}
