import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFormById, updateForm, deleteForm } from "@/services/forms";
import { getAuthedUser, hasAnyRole, EVENTS_MANAGE_ROLES } from "@/lib/api-auth";
import type { Json } from "@/types/database";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await getFormById(supabase, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({ form: data });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    name?: string;
    schema?: unknown;
    label_id?: string | null;
    records_attendance?: boolean;
    is_active?: boolean;
    redirect_url?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.schema !== undefined) patch.schema = body.schema as Json;
  if (body.label_id !== undefined) patch.label_id = body.label_id;
  if (body.records_attendance !== undefined)
    patch.records_attendance = body.records_attendance;
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.redirect_url !== undefined) patch.redirect_url = body.redirect_url;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await updateForm(supabase, id, patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ form: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, EVENTS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await deleteForm(supabase, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
