import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteContacts } from "@/lib/api-auth";
import {
  setPrimaryEmail,
  setPrimaryPhone,
} from "@/services/contact-identifiers";

/**
 * POST /api/contacts/[id]/identifiers/[kind]/[identifierId]/primary
 * Promotes the given email or phone row to be the contact's primary.
 * The previous primary is demoted; the contacts.email / phone cache
 * follows via DB trigger.
 */
export async function POST(
  _request: Request,
  context: {
    params: Promise<{ id: string; kind: string; identifierId: string }>;
  }
) {
  const { id: contactId, kind, identifierId } = await context.params;

  if (kind !== "email" && kind !== "phone") {
    return NextResponse.json({ error: "Bad kind" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await canWriteContacts(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();
  const result =
    kind === "email"
      ? await setPrimaryEmail(adminSupabase, { id: identifierId, contactId })
      : await setPrimaryPhone(adminSupabase, { id: identifierId, contactId });

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message ?? "Set primary failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
