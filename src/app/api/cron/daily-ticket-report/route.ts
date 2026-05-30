/**
 * GET /api/cron/daily-ticket-report
 *
 * Runs daily on a Vercel cron. Builds yesterday's ticket-sales
 * summary and posts it to a Slack channel — intended for super
 * admins / leadership visibility.
 *
 * Audience model:
 *   • Channel post, not DM. The channel is configured via
 *     SLACK_TICKETS_REPORT_CHANNEL_ID env var, with a fallback to
 *     SLACK_ACTIVITY_CHANNEL_ID. Create a private channel (e.g.
 *     #ffsa-leadership) and invite only the super admins to scope
 *     this audience without needing Slack-user-id mapping (Phase 2
 *     work). Once user mapping ships, we can swap to per-super-admin
 *     DMs trivially.
 *
 * Schedule: `0 6 * * *` UTC = 08:00 SAST. Configured in vercel.json.
 *
 * Auth: same `Authorization: Bearer ${CRON_SECRET}` pattern as
 * /api/cron/send-scheduled.
 */

import { NextResponse } from "next/server";
import * as slack from "@/lib/slack/client";
import {
  buildDailyTicketReport,
  renderDailyTicketReportMessage,
} from "@/lib/slack/daily-ticket-report";

export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json(
      { skipped: true, reason: "SLACK_BOT_TOKEN not configured" },
      { status: 200 }
    );
  }

  const channelId =
    process.env.SLACK_TICKETS_REPORT_CHANNEL_ID ||
    process.env.SLACK_ACTIVITY_CHANNEL_ID;

  if (!channelId) {
    return NextResponse.json(
      {
        skipped: true,
        reason:
          "Neither SLACK_TICKETS_REPORT_CHANNEL_ID nor SLACK_ACTIVITY_CHANNEL_ID is set",
      },
      { status: 200 }
    );
  }

  let report;
  try {
    report = await buildDailyTicketReport();
  } catch (err) {
    console.error("[daily-ticket-report] build failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const message = renderDailyTicketReportMessage(report);

  try {
    const res = await slack.postMessage({
      channel: channelId,
      text: message.text,
      blocks: message.blocks,
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          posted: false,
          slack_error: res.error,
          window_start: report.windowStart,
          tickets: report.tickets,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      posted: true,
      channel: channelId,
      message_ts: res.ts ?? null,
      window_start: report.windowStart,
      window_end: report.windowEnd,
      tickets: report.tickets,
      orders: report.ordersCount,
      revenue_cents: report.revenueCents,
      top_event_count: report.topEvents.length,
    });
  } catch (err) {
    console.error("[daily-ticket-report] post threw", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
