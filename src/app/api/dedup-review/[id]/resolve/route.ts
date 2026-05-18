import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveDiscard,
  resolveKeepSeparate,
  resolveMergeIntoExisting,
} from "@/services/dedup-review";

type ResolutionKind = "merge" | "separate" | "discard";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { kind?: ResolutionKind; targetContactId?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  switch (body.kind) {
    case "merge": {
      if (!body.targetContactId) {
        return NextResponse.json(
          { error: "targetContactId required for merge" },
          { status: 400 }
        );
      }
      const result = await resolveMergeIntoExisting(supabase, {
        reviewId,
        targetContactId: body.targetContactId,
        userId: user.id,
        notes: body.notes,
      });
      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }
    case "separate": {
      const result = await resolveKeepSeparate(supabase, {
        reviewId,
        userId: user.id,
        notes: body.notes,
      });
      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }
    case "discard": {
      const result = await resolveDiscard(supabase, {
        reviewId,
        userId: user.id,
        notes: body.notes,
      });
      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json(
        { error: "kind must be 'merge', 'separate', or 'discard'" },
        { status: 400 }
      );
  }
}
