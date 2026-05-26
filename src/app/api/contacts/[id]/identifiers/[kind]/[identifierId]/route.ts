import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  removeContactEmail,
  removeContactPhone,
} from "@/services/contact-identifiers";

/**
 * DELETE /api/contacts/[id]/identifiers/[kind]/[identifierId]
 * Removes a single email or phone row from the contact. If the row
 * was primary, the DB trigger auto-promotes the next-oldest row.
 */
export async function DELETE(
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
      ? await removeContactEmail(adminSupabase, identifierId)
      : await removeContactPhone(adminSupabase, identifierId);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message ?? "Delete failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, contactId });
}

async function canWriteContacts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", [
      "super_admin",
      "admin",
      "comms_admin",
      "contacts_admin",
    ])
    .limit(1);
  return !!data && data.length > 0;
}
