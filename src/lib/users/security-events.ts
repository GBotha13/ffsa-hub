import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityEvent = {
  id: string;
  action: string;
  created_at: string;
  changes: Record<string, unknown> | null;
};

// Auth-related audit actions surfaced on the admin user-detail "Security
// activity" card. Everything is written elsewhere into audit_logs; this just
// reads the slice that matters for account security.
const SECURITY_ACTIONS = [
  "password_reset_requested",
  "password_changed",
  "email_change_requested",
  "email_changed",
  "failed_login",
];

export async function getUserSecurityEvents(
  userId: string,
  limit = 15
): Promise<SecurityEvent[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_logs")
    .select("id, action, created_at, changes")
    .eq("resource_id", userId)
    .in("action", SECURITY_ACTIONS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as SecurityEvent[];
}
