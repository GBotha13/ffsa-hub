import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEvent } from "@/services/events";
import { getAuthedUser, hasAnyRole, EVENTS_MANAGE_ROLES } from "@/lib/api-auth";

// PATCH /api/events/[id] — update event-level CRM fields (base label, etc.)
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

  let body: { base_label_id?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only the CRM-related fields + lifecycle status are patchable here; core
  // event editing stays on the existing event edit flow.
  const patch: Record<string, unknown> = {};
  if ("base_label_id" in body) patch.base_label_id = body.base_label_id ?? null;
  if ("status" in body) {
    const allowed = ["draft", "published", "cancelled", "completed"];
    if (!allowed.includes(body.status as string)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No patchable fields provided" }, { status: 400 });
  }

  const { data, error } = await updateEvent(supabase, id, patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}
