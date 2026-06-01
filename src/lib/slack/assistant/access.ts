/**
 * Access control for the inbound Slack Q&A bot.
 *
 * v1 policy (locked with the user): a private admin channel + an
 * allowlist of specific Slack user IDs. Everyone allowed sees
 * everything — no per-Hub-role gating yet.
 *
 * Rules:
 *   1. The asking Slack user MUST be on SLACK_ALLOWED_USER_IDS.
 *   2. In a channel, that channel MUST be SLACK_ALLOWED_CHANNEL_ID.
 *      (DMs from an allowed user are always fine.)
 *
 * Config is env-based for v1. The slack_settings.qa_* columns
 * (migration 074) are the documented DB-managed upgrade path; this
 * function stays the single chokepoint when that lands.
 */

export type AccessDecision = { ok: true } | { ok: false; reason: string };

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowed(args: {
  channelId: string;
  userId: string;
  isDM: boolean;
}): AccessDecision {
  const allowedUsers = parseList(process.env.SLACK_ALLOWED_USER_IDS);
  const allowedChannel = (process.env.SLACK_ALLOWED_CHANNEL_ID ?? "").trim();

  // Fail closed if nothing is configured — better silent than leaky.
  if (allowedUsers.length === 0) {
    return {
      ok: false,
      reason:
        "The FFSA Hub bot isn't configured with an allowlist yet, so I can't answer.",
    };
  }

  if (!allowedUsers.includes(args.userId)) {
    return {
      ok: false,
      reason: "Sorry — you're not on the FFSA Hub bot allowlist.",
    };
  }

  if (!args.isDM) {
    if (!allowedChannel || args.channelId !== allowedChannel) {
      return {
        ok: false,
        reason:
          "I only answer in the private admin channel or via direct message.",
      };
    }
  }

  return { ok: true };
}
