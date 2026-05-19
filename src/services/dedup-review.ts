import type { TablesInsert } from "@/types/database";
import { addLabelToContact } from "./labels";
import { logContactCreated, logLabelAdded } from "./activity-events";
import { normalizePhoneE164 } from "@/lib/phone";

type ContactInsert = TablesInsert<"contacts">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// List / read
// ────────────────────────────────────────────────────────────

export async function listDedupReview(
  supabase: Client,
  options?: { status?: string; limit?: number; offset?: number }
) {
  let query = supabase
    .from("dedup_review_queue")
    .select(
      "id, incoming_data, email_match_contact_id, phone_match_contact_id, source_type, source_id, status, resolution_notes, created_at, resolved_at, email_match:contacts!email_match_contact_id(id, first_name, last_name, email, phone), phone_match:contacts!phone_match_contact_id(id, first_name, last_name, email, phone)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  query = query.eq("status", options?.status ?? "pending");

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}

export async function getDedupReview(supabase: Client, id: string) {
  return supabase
    .from("dedup_review_queue")
    .select(
      "*, email_match:contacts!email_match_contact_id(*), phone_match:contacts!phone_match_contact_id(*)"
    )
    .eq("id", id)
    .maybeSingle();
}

// ────────────────────────────────────────────────────────────
// Resolutions
// ────────────────────────────────────────────────────────────

export async function resolveMergeIntoExisting(
  supabase: Client,
  args: {
    reviewId: string;
    targetContactId: string;
    userId: string;
    notes?: string | null;
  }
) {
  const review = await getDedupReview(supabase, args.reviewId);
  if (review.error || !review.data) return review;
  const incoming = (review.data.incoming_data ?? {}) as Record<string, unknown>;

  // Enrich blank fields only.
  const target = await supabase
    .from("contacts")
    .select("*")
    .eq("id", args.targetContactId)
    .single();
  if (target.error || !target.data) return target;

  const candidate: Record<string, unknown> = {};
  const enrichable = [
    "first_name",
    "last_name",
    "preferred_name",
    "email",
    "phone",
    "date_of_birth",
    "marital_status",
    "gender",
    "nationality",
    "preferred_language",
    "city",
    "province",
    "country",
    "postal_code",
    "address_line_1",
    "address_line_2",
  ];
  for (const k of enrichable) {
    const v = incoming[k];
    if (v == null || v === "") continue;
    if (target.data[k] != null && target.data[k] !== "") continue;
    candidate[k] = v;
  }

  // If we're filling in the phone, normalize it.
  if (candidate.phone) {
    const n = normalizePhoneE164(String(candidate.phone));
    if (n) candidate.phone_normalized = n;
  }

  if (Object.keys(candidate).length > 0) {
    const upd = await supabase
      .from("contacts")
      .update(candidate)
      .eq("id", args.targetContactId);
    if (upd.error) return upd;
  }

  // Apply the original source label if present in incoming data context.
  if (typeof incoming._label_id === "string") {
    const insert = await addLabelToContact(supabase, {
      contact_id: args.targetContactId,
      label_id: incoming._label_id,
      added_via: `dedup_resolution:${args.reviewId}`,
      added_by: args.userId,
    });
    if (insert.data) {
      await logLabelAdded(supabase, {
        contactId: args.targetContactId,
        labelId: incoming._label_id,
        addedVia: `dedup_resolution:${args.reviewId}`,
        userId: args.userId,
      });
    }
  }

  return supabase
    .from("dedup_review_queue")
    .update({
      status: "resolved_merge",
      resolved_by: args.userId,
      resolved_at: new Date().toISOString(),
      resolution_notes: args.notes ?? null,
    })
    .eq("id", args.reviewId);
}

export async function resolveKeepSeparate(
  supabase: Client,
  args: { reviewId: string; userId: string; notes?: string | null }
) {
  const review = await getDedupReview(supabase, args.reviewId);
  if (review.error || !review.data) return review;
  const incoming = (review.data.incoming_data ?? {}) as Record<string, unknown>;

  // Strip private _* fields (label routing, provenance) before insert —
  // they aren't real contact columns.
  const contactFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (k.startsWith("_")) continue;
    contactFields[k] = v;
  }

  // Insert as a new contact, no dedup this time.
  const insertRow: ContactInsert = {
    ...(contactFields as Partial<ContactInsert>),
    phone_normalized: incoming.phone ? normalizePhoneE164(String(incoming.phone)) : null,
  } as ContactInsert;

  const created = await supabase
    .from("contacts")
    .insert(insertRow)
    .select("id")
    .single();
  if (created.error || !created.data) return created;

  await logContactCreated(supabase, {
    contactId: created.data.id,
    source: insertRow.source,
    userId: args.userId,
  });

  if (typeof incoming._label_id === "string") {
    await addLabelToContact(supabase, {
      contact_id: created.data.id,
      label_id: incoming._label_id,
      added_via: `dedup_resolution:${args.reviewId}`,
      added_by: args.userId,
    });
    await logLabelAdded(supabase, {
      contactId: created.data.id,
      labelId: incoming._label_id,
      addedVia: `dedup_resolution:${args.reviewId}`,
      userId: args.userId,
    });
  }

  return supabase
    .from("dedup_review_queue")
    .update({
      status: "resolved_separate",
      resolved_by: args.userId,
      resolved_at: new Date().toISOString(),
      resolution_notes: args.notes ?? null,
    })
    .eq("id", args.reviewId);
}

export async function resolveDiscard(
  supabase: Client,
  args: { reviewId: string; userId: string; notes?: string | null }
) {
  return supabase
    .from("dedup_review_queue")
    .update({
      status: "resolved_discard",
      resolved_by: args.userId,
      resolved_at: new Date().toISOString(),
      resolution_notes: args.notes ?? null,
    })
    .eq("id", args.reviewId);
}
