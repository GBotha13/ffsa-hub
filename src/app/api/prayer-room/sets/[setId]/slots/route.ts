import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetSlots, addSlot } from "@/services/prayer-room";

// GET — roster slots for a set (admin client so filled/invitee names resolve).
export async function GET(_request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { setId } = await params;
  const { data, error } = await getSetSlots(createAdminClient(), setId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — add an (open) roster slot (RLS: owner of the set or staff).
export async function POST(request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { setId } = await params;
  const body = await request.json().catch(() => ({}));
  const { role } = body as { role?: string };
  if (!role) return NextResponse.json({ error: "role is required" }, { status: 400 });

  const { data, error } = await addSlot(supabase, {
    set_id: setId,
    role,
    required_label_id: (body.required_label_id as string) ?? null,
    position: typeof body.position === "number" ? body.position : 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data);
}
