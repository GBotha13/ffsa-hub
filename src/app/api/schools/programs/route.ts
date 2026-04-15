import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProgram, updateProgram } from "@/services/schools";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { name, code, description, credit_hours } = body;

  if (!name || !code) {
    return NextResponse.json(
      { error: "name and code are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createProgram(supabase, {
    name,
    code,
    description: description || null,
    credit_hours: credit_hours || 0,
    created_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, program: data });
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

  const { data, error } = await updateProgram(supabase, id, updateData);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, program: data });
}
