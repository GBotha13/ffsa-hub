import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEventOutcome, deleteEventOutcome } from "@/services/event-outcomes";
import { getAuthedUser, hasAnyRole, EVENTS_MANAGE_ROLES } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; outcomeId: string }> }
) {
  const { outcomeId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    name?: string;
    description?: string | null;
    label_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description;
  if (body.label_id !== undefined) patch.label_id = body.label_id;
  if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await updateEventOutcome(supabase, outcomeId, patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outcome: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; outcomeId: string }> }
) {
  const { outcomeId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await deleteEventOutcome(supabase, outcomeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
