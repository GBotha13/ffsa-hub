import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createQuestion, updateQuestion, deleteQuestion } from "@/services/schools";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { program_id, label, description, type, sort_order, is_required } = body;

  if (!program_id || !label) {
    return NextResponse.json(
      { error: "program_id and label are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createQuestion(supabase, {
    program_id,
    label,
    description: description || null,
    type: type || "short_answer",
    sort_order: sort_order ?? 0,
    is_required: is_required ?? true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, question: data });
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
  const { id, label, description, type, sort_order, is_required } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (label !== undefined) updateData.label = label;
  if (description !== undefined) updateData.description = description;
  if (type !== undefined) updateData.type = type;
  if (sort_order !== undefined) updateData.sort_order = sort_order;
  if (is_required !== undefined) updateData.is_required = is_required;

  const { data, error } = await updateQuestion(supabase, id, updateData);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, question: data });
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

  const { error } = await deleteQuestion(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
