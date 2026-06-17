import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteContacts } from "@/lib/api-auth";
import { mergeContacts, previewMerge } from "@/services/contact-merge";

/**
 * POST /api/contacts/[id]/merge
 * Body: { targetId: string, preview?: boolean }
 *
 * If preview=true, returns the counts of rows that would move
 * without actually merging. Otherwise performs the merge: source
 * = path id, target = body.targetId.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await canWriteContacts(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { targetId?: string; preview?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.targetId) {
    return NextResponse.json({ error: "targetId required" }, { status: 400 });
  }
  if (body.targetId === sourceId) {
    return NextResponse.json(
      { error: "Source and target must be different contacts" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  if (body.preview) {
    const counts = await previewMerge(adminSupabase, sourceId, body.targetId);
    return NextResponse.json({ preview: counts });
  }

  const result = await mergeContacts(adminSupabase, {
    sourceId,
    targetId: body.targetId,
    userId: user.id,
  });
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        error:
          (result.error as { message?: string })?.message ?? "Merge failed",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    merged: result.data,
    targetId: body.targetId,
  });
}
