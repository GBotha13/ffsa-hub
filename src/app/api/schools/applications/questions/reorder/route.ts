import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateQuestion } from "@/services/schools";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { items } = body as { items?: Array<{ id: string; sort_order: number }> };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items must be a non-empty array of { id, sort_order }" },
      { status: 400 }
    );
  }

  for (const item of items) {
    if (!item || typeof item.id !== "string" || typeof item.sort_order !== "number") {
      return NextResponse.json(
        { error: "each item must have an id (string) and sort_order (number)" },
        { status: 400 }
      );
    }
  }

  // Run updates in parallel — RLS will enforce admin access.
  const results = await Promise.all(
    items.map((item) =>
      updateQuestion(supabase, item.id, { sort_order: item.sort_order })
    )
  );

  const failure = results.find((r) => r.error);
  if (failure?.error) {
    return NextResponse.json({ error: failure.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: items.length });
}
