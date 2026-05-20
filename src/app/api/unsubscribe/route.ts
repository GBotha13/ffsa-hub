import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/tokens/unsubscribe";

// POST /api/unsubscribe — public. The signed token is the authorization.
// Body: { token, scope: 'label' | 'all' }
export async function POST(request: Request) {
  let body: { token?: string; scope?: "label" | "all" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const v = verifyUnsubscribeToken(body.token);
  if (!v.valid || !v.contactId) {
    return NextResponse.json(
      { error: `This unsubscribe link is ${v.reason ?? "invalid"}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // 'all', or 'label' with no label on the token, both become a global opt-out.
  const global = body.scope === "all" || !v.labelId;

  // Inserting an unsubscribes row fires the 046 sync trigger, which
  // removes the matching contact_labels (and, for a global opt-out,
  // sets marketing_status = 'unsubscribed_all').
  const { error } = await admin.from("unsubscribes").upsert(
    {
      contact_id: v.contactId,
      label_id: global ? null : v.labelId,
      source: "email_footer",
      reason: global ? "unsubscribed from all" : "unsubscribed from label",
    },
    {
      onConflict: global ? "contact_id" : "contact_id,label_id",
      ignoreDuplicates: true,
    }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("activity_events").insert({
    contact_id: v.contactId,
    event_type: "email_unsubscribed",
    related_label_id: global ? null : v.labelId,
    payload: { scope: global ? "all" : "label", source: "email_footer" },
  });

  return NextResponse.json({ ok: true, scope: global ? "all" : "label" });
}
