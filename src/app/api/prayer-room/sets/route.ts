import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSets,
  getOwnedSets,
  getMyRoster,
  getMyInvites,
  getSetById,
  createSet,
  updateSet,
  completeSet,
  cancelSet,
  deleteSet,
  addSlots,
} from "@/services/prayer-room";

// GET — schedule + "my" views. Reads via the admin client so other people's
// display names resolve (RLS on users is own-row-or-admin); no contact fields.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const admin = createAdminClient();

  let result;
  if (scope === "owned") {
    result = await getOwnedSets(admin, user.id, { upcoming: url.searchParams.get("upcoming") === "true" });
  } else if (scope === "roster") {
    result = await getMyRoster(admin, user.id);
  } else if (scope === "invites") {
    result = await getMyInvites(admin, user.id);
  } else if (url.searchParams.get("id")) {
    result = await getSetById(admin, url.searchParams.get("id")!);
  } else {
    result = await getSets(admin, {
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json(result.data);
}

// POST — create a devo set (RLS: owner must be self + an active member, or staff).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { set_date, start_time, end_time } = body as Record<string, string>;
  if (!set_date || !start_time || !end_time) {
    return NextResponse.json({ error: "set_date, start_time and end_time are required" }, { status: 400 });
  }
  if (end_time <= start_time) {
    return NextResponse.json({ error: "end_time must be after start_time" }, { status: 400 });
  }

  const { data: set, error } = await createSet(supabase, {
    owner_id: (body.owner_id as string) || user.id,
    created_by: user.id,
    set_date,
    start_time,
    end_time,
    title: (body.title as string) ?? null,
    theme: (body.theme as string) ?? null,
    scripture: (body.scripture as string) ?? null,
    prayer_focus: (body.prayer_focus as string) ?? null,
    setlist: (body.setlist as string) ?? null,
  });
  if (error || !set) {
    return NextResponse.json({ error: error?.message ?? "Failed to create set" }, { status: 403 });
  }

  // optional initial roster slots: [{ role, required_label_id? }]
  const slots = Array.isArray(body.slots) ? (body.slots as Array<{ role: string; required_label_id?: string }>) : [];
  if (slots.length > 0) {
    const rows = slots.map((s, i) => ({
      set_id: set.id,
      role: s.role,
      required_label_id: s.required_label_id ?? null,
      position: i,
    }));
    await addSlots(supabase, rows);
  }

  return NextResponse.json(set);
}

// PUT — update / complete / cancel a set (RLS: owner or staff).
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  let result;
  if (action === "complete") {
    result = await completeSet(supabase, id);
  } else if (action === "cancel") {
    result = await cancelSet(supabase, id);
  } else {
    const fields: Record<string, unknown> = {};
    for (const k of ["title", "theme", "scripture", "prayer_focus", "setlist", "set_date", "start_time", "end_time", "owner_id"]) {
      if (k in body) fields[k] = body[k];
    }
    result = await updateSet(supabase, id, fields);
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 403 });
  return NextResponse.json(result.data);
}

// DELETE — remove a set (RLS: owner or staff).
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await deleteSet(supabase, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
