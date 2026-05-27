/**
 * Recipient routing for Slack notifications.
 *
 * Decides:
 *   • Which signal tier a given event_type belongs to.
 *   • Who (which Hub user ids) should receive a Tier-1 DM.
 *   • Who should receive the Tier-2 daily digest entry.
 *
 * Tier rules are defined here so changing them is a one-file edit.
 *
 * v1 scope: only users with `comms_admin` role and a populated
 * `slack_user_id` are eligible. The role gate lives in
 * `listCommsAdmins` — widen later by listing more role names.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

// ────────────────────────────────────────────────────────────
// Tier sets
// ------------------------------------------------------------
// Tier-3 is explicitly listed (rather than "everything else") so
// new event_types that get added later default to "unhandled"
// rather than silently spamming people.
// ────────────────────────────────────────────────────────────

const TIER1_EVENTS = new Set<string>([
  "form_submitted",
  "email_bounced",
  "email_complained",
  "ticket_purchased",
  "assignment_changed", // synthetic; not in activity_events
]);

const TIER2_EVENTS = new Set<string>([
  "contact_created",
  "contact_merged",
  "label_added",
  "event_attended",
  "ticket_refunded",
  "ticket_checked_in",
  "manual_interaction",
]);

const TIER3_EVENTS = new Set<string>([
  "email_sent",
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_unsubscribed",
  "label_removed",
  "csv_imported",
  "note_added",
  "contact_updated",
]);

export type Tier = "tier1" | "tier2" | "tier3";

/**
 * Map an event_type to its signal tier. Returns null for unknown
 * event types so the dispatcher can ignore them safely.
 */
export function classifyTier(eventType: string): Tier | null {
  if (TIER1_EVENTS.has(eventType)) return "tier1";
  if (TIER2_EVENTS.has(eventType)) return "tier2";
  if (TIER3_EVENTS.has(eventType)) return "tier3";
  return null;
}

// ────────────────────────────────────────────────────────────
// Recipient resolution
// ────────────────────────────────────────────────────────────

export type EventForRouting = {
  id: string;
  event_type: string;
  contact_id: string | null;
  related_user_id: string | null;
  payload: Record<string, unknown> | null;
};

/**
 * Tier-1 recipients.
 *
 * Rules:
 *   1. If the contact has an owner (`contacts.owner_id`), that
 *      user is the primary recipient.
 *   2. If the contact is unowned (or has no contact at all),
 *      fall back to every active `comms_admin`.
 *   3. Always exclude `related_user_id` — the person who took
 *      the action doesn't need a DM about their own action.
 *   4. Require `slack_user_id IS NOT NULL` and (no prefs row OR
 *      prefs.tier1_dm_enabled = true).
 */
export async function resolveTier1Recipients(
  event: EventForRouting
): Promise<string[]> {
  const admin = createAdminClient();
  const candidates = new Set<string>();

  if (event.contact_id) {
    const { data: contact } = await admin
      .from("contacts")
      .select("owner_id")
      .eq("id", event.contact_id)
      .maybeSingle();
    if (contact?.owner_id) candidates.add(contact.owner_id);
  }

  // Fallback / fan-out
  if (candidates.size === 0) {
    const adminIds = await listCommsAdmins(admin);
    adminIds.forEach((id) => candidates.add(id));
  }

  // Self-exclusion
  if (event.related_user_id) candidates.delete(event.related_user_id);

  return filterEligible(admin, Array.from(candidates), "tier1");
}

/**
 * Tier-2 daily-digest recipient.
 *
 * Rules:
 *   1. Only the contact's owner. We don't fan out Tier-2 events
 *      to comms_admin at large — that would drown them in noise.
 *   2. Self-exclude when the owner is the actor.
 *   3. Eligibility = slack_user_id present + tier2_digest_enabled
 *      (or no prefs row at all).
 */
export async function resolveTier2DigestRecipient(
  event: EventForRouting
): Promise<string | null> {
  if (!event.contact_id) return null;
  const admin = createAdminClient();

  const { data: contact } = await admin
    .from("contacts")
    .select("owner_id")
    .eq("id", event.contact_id)
    .maybeSingle();
  if (!contact?.owner_id) return null;
  if (event.related_user_id === contact.owner_id) return null;

  const eligible = await filterEligible(admin, [contact.owner_id], "tier2");
  return eligible[0] ?? null;
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

/**
 * Return user_id values for every user with the comms_admin role.
 * Uses the !inner join trick (see `src/services/roles.ts:30`).
 */
async function listCommsAdmins(admin: AdminClient): Promise<string[]> {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id, roles!inner(name)")
    .eq("roles.name", "comms_admin");
  if (error) {
    console.error("[slack/routing] listCommsAdmins failed", error);
    return [];
  }
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

/**
 * Filter a set of user_ids down to those who:
 *   • have a slack_user_id set, AND
 *   • either have no prefs row (defaults = enabled), or have the
 *     relevant tier enabled in their prefs.
 */
async function filterEligible(
  admin: AdminClient,
  userIds: string[],
  tier: "tier1" | "tier2"
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const [{ data: users }, { data: prefs }] = await Promise.all([
    admin
      .from("users")
      .select("id, slack_user_id, is_active")
      .in("id", userIds),
    admin
      .from("notification_preferences")
      .select("user_id, tier1_dm_enabled, tier2_digest_enabled")
      .in("user_id", userIds),
  ]);

  const prefMap = new Map<
    string,
    { tier1_dm_enabled: boolean; tier2_digest_enabled: boolean }
  >();
  for (const p of (prefs ?? []) as Array<{
    user_id: string;
    tier1_dm_enabled: boolean;
    tier2_digest_enabled: boolean;
  }>) {
    prefMap.set(p.user_id, {
      tier1_dm_enabled: p.tier1_dm_enabled,
      tier2_digest_enabled: p.tier2_digest_enabled,
    });
  }

  return ((users ?? []) as Array<{
    id: string;
    slack_user_id: string | null;
    is_active: boolean | null;
  }>)
    .filter((u) => u.slack_user_id && u.is_active !== false)
    .filter((u) => {
      const pref = prefMap.get(u.id);
      if (!pref) return true; // defaults are enabled
      return tier === "tier1" ? pref.tier1_dm_enabled : pref.tier2_digest_enabled;
    })
    .map((u) => u.id);
}
