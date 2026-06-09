import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLabels,
  createLabel,
  deleteLabel,
  getUserLabels,
  getUsersWithLabel,
  assignLabel,
  removeLabel,
} from "@/services/user-labels";
import { revalidateLabelsCache } from "@/lib/cached-reads";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");
  const labelId = url.searchParams.get("labelId");
  const category = url.searchParams.get("category");

  // Get users who have a specific label
  if (action === "users_with_label" && labelId) {
    const { data, error } = await getUsersWithLabel(supabase, labelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (userId) {
    const { data, error } = await getUserLabels(supabase, userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await getLabels(supabase, { category: category ?? undefined });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();

  // Assign a label to a user
  if (body.user_id && body.label_id) {
    const { data, error } = await assignLabel(supabase, {
      user_id: body.user_id,
      label_id: body.label_id,
      assigned_by: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Create a new label
  if (body.name && body.category) {
    const { data, error } = await createLabel(supabase, {
      name: body.name,
      category: body.category,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateLabelsCache();
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const labelId = url.searchParams.get("labelId") || url.searchParams.get("id");
  const userId = url.searchParams.get("userId");

  // Remove label assignment from user
  if (userId && labelId) {
    const { error } = await removeLabel(supabase, userId, labelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Delete a label entirely
  if (labelId) {
    const { error } = await deleteLabel(supabase, labelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateLabelsCache();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "labelId is required" }, { status: 400 });
}
