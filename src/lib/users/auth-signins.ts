import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Authoritative "has this person actually signed in" data, straight from
 * Supabase Auth.
 *
 * The `public.users.last_sign_in_at` mirror is not maintained (it's null for
 * everyone — the intended `updateLastSignIn` hook was never wired up), and
 * `accepted_at` was never set for founder/seed accounts. So the user lifecycle
 * derivation can't trust those columns to decide "Invited" vs joined. Supabase
 * Auth, however, records every real sign-in automatically — and a sign-in IS
 * proof the person accepted their invite. This reads that ground truth.
 *
 * Returns a map of user id → last_sign_in_at (ISO string), or null when the
 * user has never signed in (still genuinely "Invited").
 */
export async function getAuthSignIns(): Promise<Map<string, string | null>> {
  const admin = createAdminClient();
  const map = new Map<string, string | null>();
  // listUsers paginates (perPage max 1000). The page cap is a safety backstop.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    const users = data?.users ?? [];
    if (error || users.length === 0) break;
    for (const u of users) map.set(u.id, u.last_sign_in_at ?? null);
    if (users.length < 1000) break;
  }
  return map;
}
