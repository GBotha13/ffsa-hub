import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
} from "@/services/outreach-finance";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { team_id, user_id, role } = body;

  if (!team_id || !user_id) {
    return NextResponse.json(
      { error: "team_id and user_id are required" },
      { status: 400 }
    );
  }

  const { data, error } = await addTeamMember(supabase, {
    team_id,
    user_id,
    role: role || "team_member",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, member: data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { id, role } = body;

  if (!id || !role) {
    return NextResponse.json(
      { error: "id and role are required" },
      { status: 400 }
    );
  }

  const { data, error } = await updateTeamMemberRole(supabase, id, role);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, member: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await removeTeamMember(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
