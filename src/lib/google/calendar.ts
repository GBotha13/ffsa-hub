// ────────────────────────────────────────────────────────────
// FFSA Hub — Google Calendar ACL Integration
// ────────────────────────────────────────────────────────────
// Shares the FFSA base Google Calendar with staff (read-only)
// via the Calendar ACL API. Requires a one-time OAuth connect
// flow to store a refresh token (see /api/integrations/google-calendar/).
// ────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleCalendarRedirectUri(): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    "http://localhost:3000/api/integrations/google-calendar/callback"
  );
}

// ────────────────────────────────────────────────────────────
// TOKEN MANAGEMENT (Supabase)
// ────────────────────────────────────────────────────────────

export async function getStoredCalendarTokens(supabase: Client) {
  const { data, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("key", "default")
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    key: string;
    refresh_token: string;
    access_token: string | null;
    expires_at: string | null;
    connected_by: string | null;
    updated_at: string;
  };
}

export async function saveCalendarTokens(
  supabase: Client,
  data: {
    refresh_token: string;
    access_token: string;
    expires_at: string;
    connected_by?: string;
  }
) {
  const { error } = await supabase
    .from("google_calendar_tokens")
    .upsert(
      {
        key: "default",
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        expires_at: data.expires_at,
        connected_by: data.connected_by ?? null,
      },
      { onConflict: "key" }
    );
  return { error };
}

export async function deleteCalendarTokens(supabase: Client) {
  const { error } = await supabase
    .from("google_calendar_tokens")
    .delete()
    .eq("key", "default");
  return { error };
}

// ────────────────────────────────────────────────────────────
// ACCESS TOKEN REFRESH
// ────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("[google-calendar] OAuth client env vars not set");
    return null;
  }

  const admin = createAdminClient();
  const tokens = await getStoredCalendarTokens(admin);
  if (!tokens) {
    console.warn("[google-calendar] no stored tokens — run the connect flow");
    return null;
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("[google-calendar] token refresh failed:", await res.text());
    return null;
  }

  const json = await res.json();
  return json.access_token as string;
}

// ────────────────────────────────────────────────────────────
// CALENDAR ACL
// ────────────────────────────────────────────────────────────

// `accessToken` lets a caller looping over many users (e.g. the one-time
// backfill) fetch the token once and reuse it, instead of refreshing it on
// every single call — Google's token endpoint has its own rate limit, and
// this would otherwise double the number of API calls for a bulk share.
export async function addUserToBaseCalendar(
  email: string,
  accessToken?: string
): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    console.warn("[google-calendar] GOOGLE_CALENDAR_ID not set — skipping");
    return;
  }

  const token = accessToken ?? (await getAccessToken());
  if (!token) return;

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/acl`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      scope: { type: "user", value: email },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason =
      body?.error?.errors?.[0]?.reason ??
      body?.error?.message ??
      String(res.status);
    // Already shared — not an error
    if (reason === "duplicate" || reason === "alreadyExists") {
      console.log(`[google-calendar] ${email} already has access`);
      return;
    }
    // Non-Google email address — log quietly, don't break onboarding
    console.warn(`[google-calendar] ACL insert failed for ${email}: ${reason}`);
    return;
  }

  console.log(`[google-calendar] shared base calendar with ${email}`);
}

export async function removeUserFromBaseCalendar(email: string): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    console.warn("[google-calendar] GOOGLE_CALENDAR_ID not set — skipping remove");
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  const ruleId = `user:${email}`;
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/acl/${encodeURIComponent(ruleId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return; // not on calendar — no-op
  if (!res.ok) {
    console.warn(`[google-calendar] ACL delete failed for ${email}: ${res.status}`);
    return;
  }
  console.log(`[google-calendar] removed ${email} from base calendar`);
}

// Re-checks the user's current roles and adds or removes them from the
// base calendar accordingly. Use after any operation that might have changed
// whether a user holds the staff role.
export async function syncCalendarAccess(userId: string, email: string): Promise<void> {
  if (!email) return;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .eq("roles.name", "staff")
    .limit(1);
  const isStaff = !!(rows && rows.length > 0);
  if (isStaff) await addUserToBaseCalendar(email);
  else await removeUserFromBaseCalendar(email);
}
