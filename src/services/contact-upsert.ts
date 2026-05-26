import type { TablesInsert } from "@/types/database";
import { findDedupMatches } from "./contacts";
import { addLabelToContact } from "./labels";
import {
  logContactCreated,
  logLabelAdded,
  logCsvImported,
} from "./activity-events";
import { normalizeEmail, normalizePhoneE164 } from "@/lib/phone";
import {
  addContactEmail,
  addContactPhone,
  listContactEmails,
  listContactPhones,
} from "./contact-identifiers";

type ContactInsert = TablesInsert<"contacts">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type DedupOutcome =
  | { action: "created"; contactId: string }
  | { action: "matched"; contactId: string; enrichedFields: string[] }
  | { action: "queued_for_review"; reviewId: string };

export type UpsertInput = {
  /** Raw contact fields. email / phone are required (at least one); the rest are filled in if present. */
  contact: Omit<ContactInsert, "email_normalized" | "phone_normalized"> & {
    email?: string | null;
    phone?: string | null;
  };
  /** Required: the label to apply on create or merge. Pass null to skip label assignment. */
  labelId: string | null;
  /** Source attribution string (e.g. 'csv:<import_id>', 'form:<form_id>', 'manual:<user_id>'). */
  addedVia: string;
  /** Staff user performing the action, if any. */
  userId: string | null;
  /** Where this contact came from (the {source} from spec §3.1; e.g. 'csv:send-2026'). */
  source?: string | null;
  /** For dedup-review-queue rows: which upstream system raised it. */
  reviewSource: { type: "form" | "csv" | "manual"; id: string | null };
  /** Default region for phone normalization. Default: ZA. */
  defaultPhoneRegion?: string;
};

/**
 * The single entry point for inserting a contact when you don't already
 * have a contact id. Handles normalization, dedup, merge-or-create, label
 * assignment, and activity-event logging in one place.
 *
 * Always run with a service-role client when called from a public form
 * handler (the contact may not yet exist for the requesting auth user).
 */
export async function upsertContactWithDedup(
  supabase: Client,
  input: UpsertInput
): Promise<{ data: DedupOutcome | null; error: unknown }> {
  const emailNormalized = normalizeEmail(input.contact.email);
  const phoneNormalized = normalizePhoneE164(
    input.contact.phone,
    (input.defaultPhoneRegion ?? "ZA") as "ZA"
  );

  if (!emailNormalized && !phoneNormalized) {
    return {
      data: null,
      error: new Error("Cannot upsert contact: at least one of email or phone is required."),
    };
  }

  // 1. Match
  const matches = await findDedupMatches(supabase, { emailNormalized, phoneNormalized });
  if (matches.error) return { data: null, error: matches.error };
  const matched = matches.data ?? [];

  // 2. Outcome decision
  if (matched.length === 0) {
    // Insert new
    const insertRow: ContactInsert = {
      ...input.contact,
      phone_normalized: phoneNormalized,
      source: input.source ?? input.contact.source ?? null,
    };
    const created = await supabase
      .from("contacts")
      .insert(insertRow)
      .select("id")
      .single();
    if (created.error || !created.data) return { data: null, error: created.error };

    // Mirror the email/phone into the join tables as primary rows.
    // The cache trigger will keep contacts.email/phone in sync going
    // forward, but on initial insert we need a row to exist in the
    // join tables so subsequent dedup queries find it.
    if (input.contact.email && input.contact.email.trim()) {
      await addContactEmail(supabase, {
        contactId: created.data.id,
        email: input.contact.email,
        label: "primary",
        makePrimary: true,
        source: input.source ?? input.contact.source ?? null,
      });
    }
    if (input.contact.phone && input.contact.phone.trim()) {
      await addContactPhone(supabase, {
        contactId: created.data.id,
        phone: input.contact.phone,
        label: "primary",
        makePrimary: true,
        source: input.source ?? input.contact.source ?? null,
      });
    }

    await logContactCreated(supabase, {
      contactId: created.data.id,
      source: insertRow.source,
      userId: input.userId,
    });

    if (input.labelId) {
      await addLabelToContact(supabase, {
        contact_id: created.data.id,
        label_id: input.labelId,
        added_via: input.addedVia,
        added_by: input.userId,
      });
      await logLabelAdded(supabase, {
        contactId: created.data.id,
        labelId: input.labelId,
        addedVia: input.addedVia,
        userId: input.userId,
      });
    }

    if (input.addedVia.startsWith("csv:")) {
      const importId = input.addedVia.slice(4);
      await logCsvImported(supabase, {
        contactId: created.data.id,
        importId,
        labelId: input.labelId,
        userId: input.userId,
      });
    }

    return { data: { action: "created", contactId: created.data.id }, error: null };
  }

  if (matched.length === 1) {
    // Single match: enrich blank fields + add new identifier as a
    // secondary if it differs from anything on file + add label.
    const target = matched[0].contact;
    const enrichedFields = await enrichContact(supabase, target.id, input.contact);
    const addedIdentifiers = await addNewIdentifiersAsSecondary(supabase, {
      contactId: target.id,
      incomingEmail: input.contact.email ?? null,
      incomingPhone: input.contact.phone ?? null,
      source: input.source ?? input.contact.source ?? null,
    });

    if (input.labelId) {
      const insertResult = await addLabelToContact(supabase, {
        contact_id: target.id,
        label_id: input.labelId,
        added_via: input.addedVia,
        added_by: input.userId,
      });
      // Only log label_added if the upsert actually inserted a new row.
      if (insertResult.data) {
        await logLabelAdded(supabase, {
          contactId: target.id,
          labelId: input.labelId,
          addedVia: input.addedVia,
          userId: input.userId,
        });
      }
    }

    if (input.addedVia.startsWith("csv:")) {
      const importId = input.addedVia.slice(4);
      await logCsvImported(supabase, {
        contactId: target.id,
        importId,
        labelId: input.labelId,
        userId: input.userId,
      });
    }

    return {
      data: {
        action: "matched",
        contactId: target.id,
        enrichedFields: [...enrichedFields, ...addedIdentifiers],
      },
      error: null,
    };
  }

  // 3. Two distinct matches: email hits A, phone hits B. Queue for review.
  const emailMatch = matched.find((m) => m.matched_on.includes("email"));
  const phoneMatch = matched.find((m) => m.matched_on.includes("phone"));

  // Embed the pending labelId (and addedVia) inside incoming_data so the
  // resolution step can re-apply them once a human picks a path.
  const incomingPayload = {
    ...input.contact,
    _label_id: input.labelId,
    _added_via: input.addedVia,
  };

  const review = await supabase
    .from("dedup_review_queue")
    .insert({
      incoming_data: incomingPayload as Record<string, unknown>,
      email_match_contact_id: emailMatch?.contact.id ?? null,
      phone_match_contact_id: phoneMatch?.contact.id ?? null,
      source_type: input.reviewSource.type,
      source_id: input.reviewSource.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (review.error || !review.data) return { data: null, error: review.error };

  return {
    data: { action: "queued_for_review", reviewId: review.data.id },
    error: null,
  };
}

// ────────────────────────────────────────────────────────────
// Enrich an existing contact: only fill in blank fields, never
// overwrite existing values. Returns the list of fields filled.
// ────────────────────────────────────────────────────────────

async function enrichContact(
  supabase: Client,
  contactId: string,
  incoming: Omit<ContactInsert, "email_normalized" | "phone_normalized">
): Promise<string[]> {
  const existing = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .single();

  if (existing.error || !existing.data) return [];
  const row = existing.data;

  const candidate: Record<string, unknown> = {};
  const filled: string[] = [];

  // Fields we'll enrich if the existing row has them blank.
  const enrichable = [
    "first_name",
    "last_name",
    "preferred_name",
    "email",
    "phone",
    "phone_normalized",
    "date_of_birth",
    "marital_status",
    "gender",
    "nationality",
    "preferred_language",
    "preferred_channel",
    "address_line_1",
    "address_line_2",
    "city",
    "province",
    "country",
    "postal_code",
  ] as const;

  for (const key of enrichable) {
    const incomingValue = (incoming as Record<string, unknown>)[key];
    if (incomingValue == null || incomingValue === "") continue;
    if (row[key] != null && row[key] !== "") continue;
    candidate[key] = incomingValue;
    filled.push(key);
  }

  if (filled.length === 0) return [];

  const updated = await supabase
    .from("contacts")
    .update(candidate)
    .eq("id", contactId);

  if (updated.error) return [];
  return filled;
}

// ────────────────────────────────────────────────────────────
// Auto-merge: when a contact already exists by ANY identifier, and
// the incoming payload carries a DIFFERENT email or phone, add it as
// a non-primary row in contact_emails / contact_phones.
//
// Returns the list of fields actually added (for the matched action's
// enrichedFields telemetry).
// ────────────────────────────────────────────────────────────

async function addNewIdentifiersAsSecondary(
  supabase: Client,
  args: {
    contactId: string;
    incomingEmail: string | null;
    incomingPhone: string | null;
    source: string | null;
  }
): Promise<string[]> {
  const added: string[] = [];

  if (args.incomingEmail && args.incomingEmail.trim()) {
    const incomingNormalized = normalizeEmail(args.incomingEmail);
    if (incomingNormalized) {
      const existing = await listContactEmails(supabase, args.contactId);
      const alreadyOnFile = existing.data.some(
        (e) => e.email_normalized === incomingNormalized
      );
      if (!alreadyOnFile) {
        const result = await addContactEmail(supabase, {
          contactId: args.contactId,
          email: args.incomingEmail,
          label: "other",
          makePrimary: false,
          source: args.source,
        });
        if (result.data) added.push("contact_emails+");
      }
    }
  }

  if (args.incomingPhone && args.incomingPhone.trim()) {
    const incomingNormalized = normalizePhoneE164(args.incomingPhone);
    if (incomingNormalized) {
      const existing = await listContactPhones(supabase, args.contactId);
      const alreadyOnFile = existing.data.some(
        (p) => p.phone_normalized === incomingNormalized
      );
      if (!alreadyOnFile) {
        const result = await addContactPhone(supabase, {
          contactId: args.contactId,
          phone: args.incomingPhone,
          label: "other",
          makePrimary: false,
          source: args.source,
        });
        if (result.data) added.push("contact_phones+");
      }
    }
  }

  return added;
}
