import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addLabelToContact, findOrCreateLabel } from "@/services/labels";
import { logLabelAdded } from "@/services/activity-events";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: contactId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { labelId?: string; newLabelName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let labelId = body.labelId ?? null;

  if (!labelId && body.newLabelName) {
    const slug = slugify(body.newLabelName);
    const found = await findOrCreateLabel(supabase, {
      slug,
      name: body.newLabelName.trim(),
      createdBy: user.id,
    });
    if (found.error || !found.data) {
      return NextResponse.json(
        { error: "Failed to create label" },
        { status: 500 }
      );
    }
    labelId = found.data.id;
  }

  if (!labelId) {
    return NextResponse.json(
      { error: "labelId or newLabelName is required" },
      { status: 400 }
    );
  }

  const result = await addLabelToContact(supabase, {
    contact_id: contactId,
    label_id: labelId,
    added_via: `manual:${user.id}`,
    added_by: user.id,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  // Only log if the upsert actually inserted (not a duplicate).
  if (result.data) {
    await logLabelAdded(supabase, {
      contactId,
      labelId,
      addedVia: `manual:${user.id}`,
      userId: user.id,
    });
  }

  return NextResponse.json({ labelId, contactId, added: !!result.data });
}
