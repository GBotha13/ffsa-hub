/**
 * Slack notification dispatcher.
 *
 * Called fire-and-forget from `logActivity()` in
 * `src/services/activity-events.ts` after every activity_events
 * insert. Also called directly from the assign-staff routes via
 * `notifyAssignmentChanged()`.
 *
 *   ─── Phase 1 short-circuit ─────────────────────────────────
 *   This file currently only dispatches `form_submitted` events
 *   to the #ffsa-activity Slack channel. No DMs, no
 *   `notifications` rows yet. The phase-1 guards are clearly
 *   labelled — Phase 2 removes them in one pass.
 *   ───────────────────────────────────────────────────────────
 *
 * Failures inside this module are swallowed at the call site
 * (callers wrap in `void dispatchNotification(...).catch(...)`)
 * so a Slack outage never blocks user-facing requests.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import * as slack from "./client";
import {
  classifyTier,
  type EventForRouting,
} from "./routing";
import { formatNotification } from "./templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ffsahub.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

type ActivityEventRow = {
  id: string;
  event_type: string;
  contact_id: string | null;
  related_user_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
};

// ────────────────────────────────────────────────────────────
// Public entry: dispatchNotification
// ------------------------------------------------------------
// Called from logActivity() after an activity_events row is
// inserted. Performs:
//
//   1. Tier classification (tier1 / tier2 / tier3 / unknown).
//   2. Tier-3 + unknown: no-op (those live only in
//      activity_events for stat-card aggregates).
//   3. Tier-1: post to the #ffsa-activity channel.
//      [Phase 2: also create per-recipient DM rows and send.]
//   4. Tier-2: post to the #ffsa-activity channel.
//      [Phase 2: also queue digest rows for the daily cron.]
//
// In Phase 1 the dispatcher hard-skips everything except
// form_submitted (see PHASE 1 GUARD below).
// ────────────────────────────────────────────────────────────

export async function dispatchNotification(args: {
  activityEvent: ActivityEventRow;
}): Promise<void> {
  const event = args.activityEvent;

  // ───── PHASE 1 GUARD ───────────────────────────────────────
  // Only form_submitted flows in Phase 1. Remove this guard in
  // Phase 2 along with the // PHASE 1 comments throughout.
  if (event.event_type !== "form_submitted") return;
  // ───────────────────────────────────────────────────────────

  const tier = classifyTier(event.event_type);
  if (!tier || tier === "tier3") return;

  // No-op if Slack isn't configured. Log once so the operator
  // can spot a misconfigured environment, but never throw.
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("[slack/notify] SLACK_BOT_TOKEN missing — skipping");
    return;
  }

  const admin = createAdminClient();
  const contactName = await fetchContactName(admin, event.contact_id);
  const url = event.contact_id
    ? `${APP_URL}/contacts/${event.contact_id}`
    : APP_URL;

  const { title, blocks } = formatNotification({
    eventType: event.event_type,
    contactName,
    payload: event.payload,
    appUrl: url,
  });

  await postToActivityChannel(admin, { title, blocks });

  // PHASE 1 stops here. Phase 2 will fan out to DM recipients
  // and insert notifications rows below this line.
}

// ────────────────────────────────────────────────────────────
// Public entry: notifyAssignmentChanged (Phase 2)
// ------------------------------------------------------------
// Called from the two assign-staff route handlers when a user
// is set as assigned_staff_id on an application_responses or
// enrollments row. Not used in Phase 1 — exported so Phase 2
// can wire it without touching this file's exports.
// ────────────────────────────────────────────────────────────

export async function notifyAssignmentChanged(_args: {
  resourceType: "application_response" | "enrollment";
  resourceId: string;
  newStaffId: string;
  previousStaffId: string | null;
  assignedBy: string | null;
  programName: string;
  studentName: string;
}): Promise<void> {
  // PHASE 1: stubbed. Implemented in Phase 2 once the
  // notifications table is being written to.
  return;
}

// ────────────────────────────────────────────────────────────
// Internal: channel posting
// ────────────────────────────────────────────────────────────

/**
 * Post a message to the #ffsa-activity channel. Channel id
 * comes from `slack_settings.channel_id`; if the singleton row
 * has no channel_id we fall back to SLACK_ACTIVITY_CHANNEL_ID
 * env var (useful for Phase 1 testing before the admin page
 * exists).
 */
async function postToActivityChannel(
  admin: AdminClient,
  message: { title: string; blocks: unknown[] }
): Promise<void> {
  const channelId = await resolveActivityChannelId(admin);
  if (!channelId) {
    console.warn(
      "[slack/notify] no channel_id configured (slack_settings.channel_id and SLACK_ACTIVITY_CHANNEL_ID both empty) — skipping channel post"
    );
    return;
  }

  try {
    const res = await slack.postMessage({
      channel: channelId,
      text: message.title,
      blocks: message.blocks,
    });
    if (!res.ok) {
      console.error("[slack/notify] postMessage failed", {
        channel: channelId,
        error: res.error,
      });
    }
  } catch (err) {
    console.error("[slack/notify] channel post threw", err);
  }
}

async function resolveActivityChannelId(admin: AdminClient): Promise<string | null> {
  // Prefer the DB-configured channel so the admin page can
  // change it without a redeploy. Fall back to env for
  // bootstrap / Phase 1 testing.
  const { data, error } = await admin
    .from("slack_settings")
    .select("channel_id")
    .eq("id", "global")
    .maybeSingle();
  if (error) {
    console.error("[slack/notify] slack_settings read failed", error);
  }
  const dbChannel = (data as { channel_id: string | null } | null)?.channel_id;
  return dbChannel || process.env.SLACK_ACTIVITY_CHANNEL_ID || null;
}

// ────────────────────────────────────────────────────────────
// Internal: contact name lookup
// ────────────────────────────────────────────────────────────

async function fetchContactName(
  admin: AdminClient,
  contactId: string | null
): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await admin
    .from("contacts")
    .select("first_name, last_name, preferred_name")
    .eq("id", contactId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
  };
  const first = row.preferred_name ?? row.first_name ?? "";
  const last = row.last_name ?? "";
  const joined = `${first} ${last}`.trim();
  return joined.length > 0 ? joined : null;
}

// Type-only re-export so callers don't need to import from routing.
export type { EventForRouting };
