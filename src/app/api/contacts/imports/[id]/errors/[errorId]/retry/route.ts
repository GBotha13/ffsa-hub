import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertContactWithDedup } from "@/services/contact-upsert";
import { getCsvImport } from "@/services/csv-imports";
import {
  classifyError,
  getImportError,
  markErrorDismissed,
  markErrorResolved,
  updateImportErrorMessage,
} from "@/services/csv-import-errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; errorId: string }> }
) {
  const { id: importId, errorId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isCommsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email && !body.phone) {
    return NextResponse.json(
      { error: "At least one of email or phone is required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  const errorRow = await getImportError(adminSupabase, errorId);
  if (errorRow.error || !errorRow.data) {
    return NextResponse.json({ error: "Error row not found" }, { status: 404 });
  }
  if (errorRow.data.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${errorRow.data.status}` },
      { status: 400 }
    );
  }

  const importRow = await getCsvImport(adminSupabase, importId);
  if (importRow.error || !importRow.data) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  const imp = importRow.data;

  // Merge the user-edited fields back on top of the raw row so any
  // other fields (DOB, city, etc.) still get attempted.
  const merged = {
    ...(errorRow.data.raw_row as Record<string, unknown>),
    first_name: body.first_name,
    last_name: body.last_name,
    email: body.email,
    phone: body.phone,
  };

  const result = await upsertContactWithDedup(adminSupabase, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contact: merged as any,
    labelId: imp.label_id,
    addedVia: `csv:${importId}:retry`,
    userId: user.id,
    source: `csv:${imp.filename}:retry`,
    reviewSource: { type: "csv", id: importId },
  });

  if (result.error || !result.data) {
    const message =
      (result.error as { message?: string })?.message ?? "Retry failed";
    // Update the error row so the new message + classification are
    // visible on next refresh, but keep it pending.
    await updateImportErrorMessage(adminSupabase, errorId, {
      errorMessage: message,
      errorCode: classifyError(message, { email: body.email, phone: body.phone }),
    });
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (result.data.action === "queued_for_review") {
    // Mark as resolved-ish: it's left the error queue and entered the
    // dedup review queue. resolved_contact_id is null since two
    // contacts matched.
    await markErrorDismissed(adminSupabase, errorId, {
      userId: user.id,
      note: `queued for dedup review: ${result.data.reviewId}`,
    });
    return NextResponse.json({
      action: "queued_for_review",
      reviewId: result.data.reviewId,
    });
  }

  await markErrorResolved(adminSupabase, errorId, {
    contactId: result.data.contactId,
    userId: user.id,
    note: result.data.action === "matched" ? "matched existing contact" : "created",
  });

  return NextResponse.json({
    action: result.data.action,
    contactId: result.data.contactId,
  });
}

async function isCommsAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userId)
    .in("roles.name", ["super_admin", "admin", "comms_admin"])
    .limit(1);
  return !!data && data.length > 0;
}
