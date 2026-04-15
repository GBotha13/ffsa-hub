import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createResponse, updateResponseStatus } from "@/services/schools";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { program_id, answers } = body;

  if (!program_id || !answers || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "program_id and answers array are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createResponse(supabase, {
    program_id,
    user_id: user.id,
    answers,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already submitted an application for this program" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, response: data });
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
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  const { data, error } = await updateResponseStatus(supabase, id, status, user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, response: data });
}
