import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "prayer_room_admin"])
    .limit(1);
  return !!(data && data.length > 0);
}

// GET — admin fetches all requests (optionally filtered by status)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = await isAdmin(supabase, user.id);
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";

  const { data, error } = await (supabase as any)
    .from("prayer_room_eval_requests")
    .select(`
      id, role, instruments, background, status, review_note, created_at,
      users!prayer_room_eval_requests_user_id_fkey(id, first_name, last_name, preferred_name, email)
    `)
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — user submits a new eval request
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { role, instruments, background } = body;

  if (!role) return NextResponse.json({ error: "Role is required" }, { status: 400 });

  // Check for existing pending request
  const { data: existing } = await (supabase as any)
    .from("prayer_room_eval_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: existing.status === "approved" ? "You have already been approved to serve." : "You already have a pending request." },
      { status: 409 }
    );
  }

  const { data, error } = await (supabase as any)
    .from("prayer_room_eval_requests")
    .insert({
      user_id: user.id,
      role,
      instruments: instruments ?? [],
      background: background?.trim() || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — admin approves or declines a request
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = await isAdmin(supabase, user.id);
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const { id, action, review_note } = body;

  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  // Fetch the request
  const { data: evalReq, error: fetchErr } = await (supabase as any)
    .from("prayer_room_eval_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !evalReq) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (action === "approve") {
    // Update the request
    const { error: updateErr } = await (supabase as any)
      .from("prayer_room_eval_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note?.trim() || null,
      })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Auto-assign labels based on role + instruments
    const adminSupabase = createAdminClient();

    if (evalReq.role === "musician" && evalReq.instruments?.length > 0) {
      // Find label IDs for each instrument
      const { data: instrLabels } = await (adminSupabase as any)
        .from("user_labels")
        .select("id, name")
        .eq("category", "instrument")
        .in("name", evalReq.instruments);

      if (instrLabels && instrLabels.length > 0) {
        const assignments = instrLabels.map((l: { id: string }) => ({
          user_id: evalReq.user_id,
          label_id: l.id,
          assigned_by: user.id,
        }));
        await (adminSupabase as any).from("user_label_assignments").insert(assignments).onConflict("user_id,label_id").ignore();
      }
    } else {
      // Map role to label name
      const roleLabelMap: Record<string, string> = {
        worship_leader: "Worship Leader",
        prayer_leader: "Prayer Leader",
      };
      const labelName = roleLabelMap[evalReq.role];
      if (labelName) {
        const { data: roleLabel } = await (adminSupabase as any)
          .from("user_labels")
          .select("id")
          .eq("name", labelName)
          .eq("category", "ministry_role")
          .maybeSingle();

        if (roleLabel) {
          await (adminSupabase as any)
            .from("user_label_assignments")
            .insert({ user_id: evalReq.user_id, label_id: roleLabel.id, assigned_by: user.id })
            .onConflict("user_id,label_id").ignore();
        }
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "decline") {
    const { error: updateErr } = await (supabase as any)
      .from("prayer_room_eval_requests")
      .update({
        status: "declined",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note?.trim() || null,
      })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
