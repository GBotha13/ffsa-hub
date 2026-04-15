import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOutreachTeam, updateOutreachTeam } from "@/services/outreach-finance";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { program_id, team_name } = body;

  if (!program_id || !team_name) {
    return NextResponse.json(
      { error: "program_id and team_name are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createOutreachTeam(supabase, {
    ...body,
    created_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, team: data });
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
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, error } = await updateOutreachTeam(supabase, id, updateData);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, team: data });
}
