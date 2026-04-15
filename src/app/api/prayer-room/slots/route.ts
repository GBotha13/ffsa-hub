import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlots, updateSlot, completeSlot, getMySlots } from "@/services/prayer-room";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const mine = url.searchParams.get("mine") || url.searchParams.get("mySlots");
  const upcoming = url.searchParams.get("upcoming");
  const targetUserId = url.searchParams.get("userId");

  // My devo sets
  if (mine === "true") {
    const { data, error } = await getMySlots(supabase, targetUserId || user.id, {
      upcoming: upcoming === "true",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // General schedule
  const { data, error } = await getSlots(supabase, { dateFrom, dateTo });
  if (error) {
    console.error("[slots GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, action, notes, ...updateData } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (action === "complete" || updateData.status === "completed") {
    const { data, error } = await completeSlot(supabase, id, notes);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { status: _status, ...restData } = updateData;
  const { data, error } = await updateSlot(supabase, id, { ...restData, notes });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Delete slot (members cascade due to FK)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("prayer_room_slots")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
