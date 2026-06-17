import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteContacts } from "@/lib/api-auth";
import {
  addContactEmail,
  addContactPhone,
  listContactEmails,
  listContactPhones,
} from "@/services/contact-identifiers";
import { normalizeEmail, normalizePhoneE164 } from "@/lib/phone";

/**
 * POST /api/contacts/[id]/identifiers
 * Body: { email?: string|null, phone?: string|null, label?: string }
 *
 * Adds a new email and/or phone as a secondary identifier on the
 * target contact. Used by the Add-Contact dedup panel's
 * "Add this info to {name}'s record" button and by the contact
 * profile page's "+ Add email" / "+ Add phone" buttons.
 *
 * Idempotent: if the value is already on file, it's silently
 * skipped (returns ok=true with skippedExisting flag).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: contactId } = await context.params;

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

  let body: {
    email?: string | null;
    phone?: string | null;
    label?: string;
    makePrimary?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email && !body.phone) {
    return NextResponse.json(
      { error: "Provide at least one of email or phone" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Confirm the contact actually exists (and the requester can see
  // it — RLS would also catch this but the message is clearer here).
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const result: {
    emailAdded: boolean;
    phoneAdded: boolean;
    emailSkipped: boolean;
    phoneSkipped: boolean;
    errors: string[];
  } = {
    emailAdded: false,
    phoneAdded: false,
    emailSkipped: false,
    phoneSkipped: false,
    errors: [],
  };

  if (body.email && body.email.trim()) {
    const normalized = normalizeEmail(body.email);
    if (!normalized) {
      result.errors.push("Email is blank after normalization");
    } else {
      const existing = await listContactEmails(adminSupabase, contactId);
      const dupe = existing.data.some((e) => e.email_normalized === normalized);
      if (dupe) {
        result.emailSkipped = true;
      } else {
        const r = await addContactEmail(adminSupabase, {
          contactId,
          email: body.email,
          label: body.label ?? "other",
          makePrimary: body.makePrimary ?? false,
          source: `manual:${user.id}`,
        });
        if (r.error) {
          result.errors.push(
            `Email: ${(r.error as { message?: string }).message ?? "insert failed"}`
          );
        } else {
          result.emailAdded = true;
        }
      }
    }
  }

  if (body.phone && body.phone.trim()) {
    const normalized = normalizePhoneE164(body.phone);
    if (!normalized) {
      result.errors.push(
        "Phone couldn't be normalized to international format — please include the country code (e.g. +27...)"
      );
    } else {
      const existing = await listContactPhones(adminSupabase, contactId);
      const dupe = existing.data.some((p) => p.phone_normalized === normalized);
      if (dupe) {
        result.phoneSkipped = true;
      } else {
        const r = await addContactPhone(adminSupabase, {
          contactId,
          phone: body.phone,
          label: body.label ?? "other",
          makePrimary: body.makePrimary ?? false,
          source: `manual:${user.id}`,
        });
        if (r.error) {
          result.errors.push(
            `Phone: ${(r.error as { message?: string }).message ?? "insert failed"}`
          );
        } else {
          result.phoneAdded = true;
        }
      }
    }
  }

  if (result.errors.length > 0 && !result.emailAdded && !result.phoneAdded) {
    return NextResponse.json(
      { error: result.errors.join("; "), ...result },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, contactId, ...result });
}
