import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeLabelFromContact } from "@/services/labels";
import { logLabelRemoved } from "@/services/activity-events";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; labelId: string }> }
) {
  const { id: contactId, labelId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await removeLabelFromContact(supabase, contactId, labelId);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // The 046 trigger inserts the unsubscribes row. We still log the
  // activity event so the timeline shows it.
  await logLabelRemoved(supabase, {
    contactId,
    labelId,
    userId: user.id,
  });

  return NextResponse.json({ removed: true });
}
