import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addUserToBaseCalendar,
  getAccessToken,
  listBaseCalendarAclEmails,
} from "@/lib/google/calendar";

// Shared by GET (preview) and POST (actually share): every "real staff" user
// who should have base-calendar access.
//
// "Real staff" mirrors the definition migration 192 already settled on for
// ministry-roster sync: signup_type is a poor staff test (141/212 users have
// it NULL, including real staff), so the gate is "has a department and isn't
// a student" instead of signup_type === 'staff'.
async function getRealStaff() {
  // `department` isn't in the generated DB types yet (stale since it was
  // added) — cast for this query (matches the pattern in grant-role/route.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = createAdminClient() as any;
  const { data: rows, error } = await adminAny
    .from("users")
    .select("id, email, first_name, last_name, department, signup_type")
    .not("department", "is", null)
    .not("accepted_at", "is", null)
    .not("email", "is", null);

  if (error) return { staff: null, error };

  type StaffRow = {
    email: string;
    first_name: string | null;
    last_name: string | null;
    signup_type: string | null;
  };

  // Filtered in JS rather than a `.neq()` filter: signup_type IS NULL should
  // count as "not a student" (it's the common case for real staff), but
  // PostgREST's not-eq excludes NULLs under standard SQL three-valued logic.
  const staff = ((rows ?? []) as StaffRow[]).filter((u) => u.signup_type !== "student");
  return { staff, error: null };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { ok: false as const, res: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };

  return { ok: true as const };
}

// GET — preview only, no writes: real staff who are NOT currently on the
// base calendar's ACL (per Google, not our own DB — sharing state lives
// entirely in Google Calendar).
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { staff, error } = await getRealStaff();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google Calendar isn't connected — connect it under Settings first." },
      { status: 409 }
    );
  }

  const currentAcl = await listBaseCalendarAclEmails(accessToken);
  const missing = (staff ?? [])
    .filter((u) => !currentAcl.has(u.email.toLowerCase()))
    .map((u) => ({ email: u.email, name: [u.first_name, u.last_name].filter(Boolean).join(" ") }));

  return NextResponse.json({
    totalRealStaff: (staff ?? []).length,
    alreadyShared: (staff ?? []).length - missing.length,
    missingCount: missing.length,
    missing,
  });
}

// POST — Admin-only: share the FFSA base calendar with every real staff
// member who isn't on it yet.
//
// Calendar sharing only ever fires at onboarding-complete or on a role
// change (grant/revoke/convert-to-community/set-membership-role) — anyone
// who finished onboarding before this feature shipped (PR #361, 2026-09-16),
// or whose role hasn't changed since, was never shared with. This one-time
// endpoint catches all of them up.
//
// Safe to re-run: Google's ACL insert treats an existing share as a no-op
// (see addUserToBaseCalendar), so nobody is double-shared.
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { staff, error } = await getRealStaff();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch the access token once and reuse it — see addUserToBaseCalendar.
  // Fail fast rather than silently looping through everyone doing nothing.
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google Calendar isn't connected — connect it under Settings first." },
      { status: 409 }
    );
  }

  const results: { email: string; name: string }[] = [];
  for (const u of staff ?? []) {
    await addUserToBaseCalendar(u.email, accessToken);
    results.push({ email: u.email, name: [u.first_name, u.last_name].filter(Boolean).join(" ") });
  }

  return NextResponse.json({ success: true, sharedCount: results.length, shared: results });
}
