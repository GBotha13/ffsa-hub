import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addSlotMember, removeSlotMember, getSlotMembers } from "@/services/prayer-room";

async function isSlotLeader(supabase: ReturnType<typeof Object>, slotId: string, userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("prayer_room_slot_members")
    .select("role")
    .eq("slot_id", slotId)
    .eq("user_id", userId)
    .in("role", ["worship_leader", "prayer_leader"])
    .maybeSingle();

  return !!data;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const slotId = url.searchParams.get("slotId");
  if (!slotId) return NextResponse.json({ error: "slotId is required" }, { status: 400 });

  const { data, error } = await getSlotMembers(supabase, slotId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { slot_id, user_id, role, instrument } = body;

  if (!slot_id || !user_id || !role) {
    return NextResponse.json(
      { error: "slot_id, user_id, and role are required" },
      { status: 400 }
    );
  }

  // Allow if user is admin or a leader on this slot
  const leader = await isSlotLeader(supabase, slot_id, user.id);
  if (!leader) {
    // Check if admin via role
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleNames = (userRoles ?? []).flatMap((r: any) => {
      if (Array.isArray(r.roles)) return r.roles.map((role: { name: string }) => role.name);
      if (r.roles?.name) return [r.roles.name];
      return [];
    });
    const isAdmin = roleNames.includes("admin") || roleNames.includes("prayer_room_admin");

    if (!isAdmin) {
      return NextResponse.json({ error: "Not authorized to manage this slot's team" }, { status: 403 });
    }
  }

  const { data, error } = await addSlotMember(supabase, {
    slot_id,
    user_id,
    role,
    instrument: instrument ?? undefined,
    assigned_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const slotId = url.searchParams.get("slotId");
  const targetUserId = url.searchParams.get("userId");

  if (!slotId || !targetUserId) {
    return NextResponse.json({ error: "slotId and userId are required" }, { status: 400 });
  }

  // Allow if user is admin or a leader on this slot
  const leader = await isSlotLeader(supabase, slotId, user.id);
  if (!leader) {
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleNames = (userRoles ?? []).flatMap((r: any) => {
      if (Array.isArray(r.roles)) return r.roles.map((role: { name: string }) => role.name);
      if (r.roles?.name) return [r.roles.name];
      return [];
    });
    const isAdmin = roleNames.includes("admin") || roleNames.includes("prayer_room_admin");

    if (!isAdmin) {
      return NextResponse.json({ error: "Not authorized to manage this slot's team" }, { status: 403 });
    }
  }

  const { error } = await removeSlotMember(supabase, slotId, targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
