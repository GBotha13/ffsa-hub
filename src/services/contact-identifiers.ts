// Service module for contact_emails + contact_phones — the
// multi-identifier model added in migration 068.
//
// contacts.email and contacts.phone remain as a denormalised cache
// of whichever row in here has is_primary=true; DB triggers keep
// the cache in sync, so consumers that read contacts.email/phone
// directly continue to work.

import { normalizeEmail, normalizePhoneE164 } from "@/lib/phone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type ContactEmailRow = {
  id: string;
  contact_id: string;
  email: string;
  email_normalized: string;
  label: string;
  is_primary: boolean;
  source: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactPhoneRow = {
  id: string;
  contact_id: string;
  phone: string;
  phone_normalized: string | null;
  label: string;
  is_primary: boolean;
  source: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

// ────────────────────────────────────────────────────────────
// Reads
// ────────────────────────────────────────────────────────────

export async function listContactEmails(
  supabase: Client,
  contactId: string
): Promise<{ data: ContactEmailRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from("contact_emails")
    .select("*")
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as ContactEmailRow[], error };
}

export async function listContactPhones(
  supabase: Client,
  contactId: string
): Promise<{ data: ContactPhoneRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from("contact_phones")
    .select("*")
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as ContactPhoneRow[], error };
}

// ────────────────────────────────────────────────────────────
// Find by identifier — used by dedup
// ────────────────────────────────────────────────────────────

export type IdentifierMatch = {
  contact_id: string;
  matched_on: "email" | "phone";
  value: string;
};

export async function findContactsByEmail(
  supabase: Client,
  emailNormalized: string
): Promise<IdentifierMatch[]> {
  const { data } = await supabase
    .from("contact_emails")
    .select("contact_id, email_normalized")
    .eq("email_normalized", emailNormalized);
  return ((data ?? []) as Array<{ contact_id: string; email_normalized: string }>).map(
    (r) => ({
      contact_id: r.contact_id,
      matched_on: "email" as const,
      value: r.email_normalized,
    })
  );
}

export async function findContactsByPhone(
  supabase: Client,
  phoneNormalized: string
): Promise<IdentifierMatch[]> {
  const { data } = await supabase
    .from("contact_phones")
    .select("contact_id, phone_normalized")
    .eq("phone_normalized", phoneNormalized);
  return ((data ?? []) as Array<{ contact_id: string; phone_normalized: string }>).map(
    (r) => ({
      contact_id: r.contact_id,
      matched_on: "phone" as const,
      value: r.phone_normalized,
    })
  );
}

// ────────────────────────────────────────────────────────────
// Adds — used by the dedup-found "add to existing" button, the
// profile UI "+ Add email/phone", and upsertContactWithDedup's
// auto-merge branch.
// ────────────────────────────────────────────────────────────

export async function addContactEmail(
  supabase: Client,
  args: {
    contactId: string;
    email: string;
    label?: string;
    makePrimary?: boolean;
    source?: string | null;
  }
): Promise<{ data: ContactEmailRow | null; error: unknown }> {
  const normalized = normalizeEmail(args.email);
  if (!normalized) {
    return { data: null, error: new Error("Email cannot be blank") };
  }
  const isFirst = await isFirstEmailForContact(supabase, args.contactId);
  const makePrimary = args.makePrimary ?? isFirst;

  if (makePrimary) {
    // Demote existing primaries first (partial unique index would
    // otherwise reject the insert).
    await supabase
      .from("contact_emails")
      .update({ is_primary: false })
      .eq("contact_id", args.contactId)
      .eq("is_primary", true);
  }

  const { data, error } = await supabase
    .from("contact_emails")
    .insert({
      contact_id: args.contactId,
      email: args.email.trim(),
      label: args.label ?? (makePrimary ? "primary" : "other"),
      is_primary: makePrimary,
      source: args.source ?? null,
    })
    .select()
    .single();
  return { data: (data ?? null) as ContactEmailRow | null, error };
}

export async function addContactPhone(
  supabase: Client,
  args: {
    contactId: string;
    phone: string;
    label?: string;
    makePrimary?: boolean;
    source?: string | null;
  }
): Promise<{ data: ContactPhoneRow | null; error: unknown }> {
  const trimmed = args.phone.trim();
  if (!trimmed) {
    return { data: null, error: new Error("Phone cannot be blank") };
  }
  const normalized = normalizePhoneE164(trimmed);

  const isFirst = await isFirstPhoneForContact(supabase, args.contactId);
  const makePrimary = args.makePrimary ?? isFirst;

  if (makePrimary) {
    await supabase
      .from("contact_phones")
      .update({ is_primary: false })
      .eq("contact_id", args.contactId)
      .eq("is_primary", true);
  }

  const { data, error } = await supabase
    .from("contact_phones")
    .insert({
      contact_id: args.contactId,
      phone: trimmed,
      phone_normalized: normalized,
      label: args.label ?? (makePrimary ? "primary" : "other"),
      is_primary: makePrimary,
      source: args.source ?? null,
    })
    .select()
    .single();
  return { data: (data ?? null) as ContactPhoneRow | null, error };
}

// ────────────────────────────────────────────────────────────
// Updates / deletes
// ────────────────────────────────────────────────────────────

export async function updateContactEmail(
  supabase: Client,
  id: string,
  fields: { email?: string; label?: string }
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.email !== undefined) patch.email = fields.email.trim();
  if (fields.label !== undefined) patch.label = fields.label;
  return supabase.from("contact_emails").update(patch).eq("id", id).select().single();
}

export async function updateContactPhone(
  supabase: Client,
  id: string,
  fields: { phone?: string; label?: string }
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.phone !== undefined) {
    const trimmed = fields.phone.trim();
    patch.phone = trimmed;
    patch.phone_normalized = normalizePhoneE164(trimmed);
  }
  if (fields.label !== undefined) patch.label = fields.label;
  return supabase.from("contact_phones").update(patch).eq("id", id).select().single();
}

export async function removeContactEmail(supabase: Client, id: string) {
  return supabase.from("contact_emails").delete().eq("id", id);
}

export async function removeContactPhone(supabase: Client, id: string) {
  return supabase.from("contact_phones").delete().eq("id", id);
}

export async function setPrimaryEmail(
  supabase: Client,
  args: { id: string; contactId: string }
) {
  // Demote all then promote the chosen one. Two updates in sequence
  // — the partial unique index permits this because the demote takes
  // effect before the promote sees it.
  await supabase
    .from("contact_emails")
    .update({ is_primary: false })
    .eq("contact_id", args.contactId)
    .eq("is_primary", true);
  return supabase
    .from("contact_emails")
    .update({ is_primary: true })
    .eq("id", args.id)
    .select()
    .single();
}

export async function setPrimaryPhone(
  supabase: Client,
  args: { id: string; contactId: string }
) {
  await supabase
    .from("contact_phones")
    .update({ is_primary: false })
    .eq("contact_id", args.contactId)
    .eq("is_primary", true);
  return supabase
    .from("contact_phones")
    .update({ is_primary: true })
    .eq("id", args.id)
    .select()
    .single();
}

// ────────────────────────────────────────────────────────────
// Internal: check whether this contact has no emails/phones yet
// (so the first one auto-becomes primary)
// ────────────────────────────────────────────────────────────

async function isFirstEmailForContact(
  supabase: Client,
  contactId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("contact_emails")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId);
  return (count ?? 0) === 0;
}

async function isFirstPhoneForContact(
  supabase: Client,
  contactId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("contact_phones")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId);
  return (count ?? 0) === 0;
}
