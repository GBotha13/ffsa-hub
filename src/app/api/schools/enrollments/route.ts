import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEnrollment, updateEnrollmentStatus } from "@/services/schools";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { user_id, program_id, notes } = body;

  if (!user_id || !program_id) {
    return NextResponse.json(
      { error: "user_id and program_id are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createEnrollment(supabase, {
    user_id,
    program_id,
    enrolled_by: user.id,
    notes: notes || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, enrollment: data });
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

  const { data, error } = await updateEnrollmentStatus(supabase, id, status);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, enrollment: data });
}
