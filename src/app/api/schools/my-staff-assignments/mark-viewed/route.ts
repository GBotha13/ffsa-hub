import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Marks the caller's currently-unread assignments as viewed. With no body,
// marks all of the caller's unread assignments as viewed (clears the badge).
// With ids, marks only those.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { application_ids?: string[]; enrollment_ids?: string[]; all?: boolean } = { all: true };
  try {
    body = await request.json();
  } catch {
    // Empty body — treat as mark-all.
    body = { all: true };
  }

  const adminSupabase = createAdminClient();
  const nowIso = new Date().toISOString();
  // Cast around auto-generated DB types that don't yet know about the new
  // staff_viewed_at / assigned_staff_id columns (added in migration 052).
  const sb = adminSupabase as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => {
          is: (col: string, val: unknown) => Promise<unknown>;
          in: (col: string, vals: unknown[]) => Promise<unknown>;
        };
      };
    };
  };

  if (body.all || (!body.application_ids?.length && !body.enrollment_ids?.length)) {
    await Promise.all([
      sb.from("application_responses")
        .update({ staff_viewed_at: nowIso })
        .eq("assigned_staff_id", authUser.id)
        .is("staff_viewed_at", null),
      sb.from("enrollments")
        .update({ staff_viewed_at: nowIso })
        .eq("assigned_staff_id", authUser.id)
        .is("staff_viewed_at", null),
    ]);
    return NextResponse.json({ success: true });
  }

  const ops: Promise<unknown>[] = [];
  if (body.application_ids?.length) {
    ops.push(
      sb.from("application_responses")
        .update({ staff_viewed_at: nowIso })
        .eq("assigned_staff_id", authUser.id)
        .in("id", body.application_ids)
    );
  }
  if (body.enrollment_ids?.length) {
    ops.push(
      sb.from("enrollments")
        .update({ staff_viewed_at: nowIso })
        .eq("assigned_staff_id", authUser.id)
        .in("id", body.enrollment_ids)
    );
  }
  await Promise.all(ops);

  return NextResponse.json({ success: true });
}
