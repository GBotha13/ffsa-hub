import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteToSlot, acceptInvite, declineInvite, vacateSlot, removeSlot, getSlotForNotify } from "@/services/prayer-room";
import { sendPrayerRoomInvite, sendPrayerRoomInviteAccepted } from "@/lib/email/send-prayer-room";

const NAME_EMAIL = "id, first_name, last_name, preferred_name, email";

// PUT — the invite/claim loop: invite | accept | decline | vacate.
export async function PUT(request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slotId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = (body as { action?: string }).action;
  const admin = createAdminClient();

  if (action === "invite") {
    const inviteeId = (body as { invitee_id?: string }).invitee_id;
    if (!inviteeId) return NextResponse.json({ error: "invitee_id is required" }, { status: 400 });

    const { data: slot, error } = await inviteToSlot(supabase, slotId, {
      invitee_id: inviteeId,
      invited_by: user.id,
    });
    if (error || !slot) {
      return NextResponse.json({ error: error?.message ?? "Failed to invite" }, { status: 403 });
    }

    // notify the invitee (best-effort)
    const { data: people } = await admin.from("users").select(NAME_EMAIL).in("id", [inviteeId, user.id]);
    const invitee = (people ?? []).find((p: { id: string }) => p.id === inviteeId);
    const inviter = (people ?? []).find((p: { id: string }) => p.id === user.id);
    const set = slot.set ?? {};
    if (invitee) {
      await sendPrayerRoomInvite({
        invitee,
        owner: inviter ?? {},
        role: slot.role,
        setTitle: set.title ?? "Devo set",
        setDate: set.set_date,
        startTime: set.start_time,
        endTime: set.end_time,
      });
    }
    return NextResponse.json(slot);
  }

  if (action === "accept") {
    const { data, error } = await acceptInvite(supabase, slotId, user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });

    // notify the set owner (best-effort)
    const { data: slotRow } = await getSlotForNotify(admin, slotId);
    const { data: accepter } = await admin.from("users").select(NAME_EMAIL).eq("id", user.id).single();
    const set = slotRow?.set;
    if (set?.owner) {
      await sendPrayerRoomInviteAccepted({
        owner: set.owner,
        accepter: accepter ?? {},
        role: slotRow.role,
        setTitle: set.title ?? "Devo set",
        setDate: set.set_date,
        startTime: set.start_time,
        endTime: set.end_time,
      });
    }
    return NextResponse.json(data);
  }

  if (action === "decline") {
    const { data, error } = await declineInvite(supabase, slotId, user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json(data);
  }

  if (action === "vacate") {
    const { data, error } = await vacateSlot(supabase, slotId);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// DELETE — remove a roster slot (RLS: owner of the set or staff).
export async function DELETE(_request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slotId } = await params;
  const { error } = await removeSlot(supabase, slotId);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
