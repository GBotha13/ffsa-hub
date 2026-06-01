/**
 * Data access for the inbound Slack Q&A bot.
 *
 * Pure data-access (services convention): takes a Supabase client as
 * the first arg. Used by the assistant run loop with the service-role
 * admin client (the bot has no logged-in user).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/** Resolve a Slack user id to a Hub user id via users.slack_user_id (nullable). */
export async function resolveHubUserBySlackId(
  supabase: Client,
  slackUserId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Append one audit row for a question the bot answered. */
export async function logSlackBotQuery(
  supabase: Client,
  row: {
    slack_user_id: string;
    hub_user_id: string | null;
    channel_id: string;
    slack_event_id: string | null;
    question: string;
    tool_calls: unknown;
    sql_text: string | null;
    answer: string | null;
    model_used: string | null;
    latency_ms: number | null;
  }
) {
  return supabase.from("slack_bot_queries").insert(row);
}
