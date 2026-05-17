import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createReferenceQuestion,
  updateReferenceQuestion,
  deleteReferenceQuestion,
} from "@/services/schools";

function validateFollowUpFields(
  parent_question_id: unknown,
  show_when_answer: unknown
): string | null {
  const hasParent = !!parent_question_id;
  const hasAnswer = !!show_when_answer;
  if (hasParent !== hasAnswer) {
    return "parent_question_id and show_when_answer must be set together";
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const {
    program_id,
    label,
    description,
    type,
    sort_order,
    is_required,
    options,
    parent_question_id,
    show_when_answer,
  } = body;

  if (!program_id || !label) {
    return NextResponse.json(
      { error: "program_id and label are required" },
      { status: 400 }
    );
  }

  const followUpValidation = validateFollowUpFields(
    parent_question_id,
    show_when_answer
  );
  if (followUpValidation) {
    return NextResponse.json({ error: followUpValidation }, { status: 400 });
  }

  const { data, error } = await createReferenceQuestion(supabase, {
    program_id,
    label,
    description: description || null,
    type: type || "short_answer",
    sort_order: sort_order ?? 0,
    is_required: is_required ?? true,
    options: options ?? [],
    parent_question_id: parent_question_id || null,
    show_when_answer: show_when_answer || null,
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
  const {
    id,
    label,
    description,
    type,
    sort_order,
    is_required,
    options,
    parent_question_id,
    show_when_answer,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (parent_question_id !== undefined || show_when_answer !== undefined) {
    const followUpValidation = validateFollowUpFields(
      parent_question_id ?? null,
      show_when_answer ?? null
    );
    if (followUpValidation) {
      return NextResponse.json({ error: followUpValidation }, { status: 400 });
    }
    if (parent_question_id && parent_question_id === id) {
      return NextResponse.json(
        { error: "A question cannot be its own follow-up parent" },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (label !== undefined) updateData.label = label;
  if (description !== undefined) updateData.description = description;
  if (type !== undefined) updateData.type = type;
  if (sort_order !== undefined) updateData.sort_order = sort_order;
  if (is_required !== undefined) updateData.is_required = is_required;
  if (options !== undefined) updateData.options = options;
  if (parent_question_id !== undefined)
    updateData.parent_question_id = parent_question_id || null;
  if (show_when_answer !== undefined)
    updateData.show_when_answer = show_when_answer || null;

  const { data, error } = await updateReferenceQuestion(supabase, id, updateData);

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

  const { error } = await deleteReferenceQuestion(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
