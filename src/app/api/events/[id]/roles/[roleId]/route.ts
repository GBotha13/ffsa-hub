import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEventRole, deleteEventRole } from "@/services/event-roles";
import { getAuthedUser, hasAnyRole, EVENTS_MANAGE_ROLES } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; roleId: string }> }
) {
  const { roleId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    role_name?: string;
    notes?: string | null;
    sort_order?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.role_name !== undefined) patch.role_name = body.role_name.trim();
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.sort_order !== undefined) patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await updateEventRole(supabase, roleId, patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ role: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; roleId: string }> }
) {
  const { roleId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await deleteEventRole(supabase, roleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
