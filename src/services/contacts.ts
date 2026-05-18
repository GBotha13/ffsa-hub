import type { TablesInsert, TablesUpdate } from "@/types/database";
type ContactInsert = TablesInsert<"contacts">;
type ContactUpdate = TablesUpdate<"contacts">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function getContacts(
  supabase: Client,
  options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = supabase
    .from("contacts")
    .select("*, person_type_assignments(person_types(*))", { count: "exact" })
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},preferred_name.ilike.${term}`
    );
  }

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}

export async function getContactById(supabase: Client, id: string) {
  return supabase
    .from("contacts")
    .select(
      "*, person_type_assignments(person_types(*)), person_tags(tags(*))"
    )
    .eq("id", id)
    .single();
}

export async function createContact(supabase: Client, data: ContactInsert) {
  return supabase.from("contacts").insert(data).select().single();
}

export async function updateContact(
  supabase: Client,
  id: string,
  data: ContactUpdate
) {
  return supabase.from("contacts").update(data).eq("id", id).select().single();
}

export async function archiveContact(supabase: Client, id: string) {
  return supabase
    .from("contacts")
    .update({ status: "archived" })
    .eq("id", id)
    .select()
    .single();
}

export async function findDuplicates(
  supabase: Client,
  data: { first_name: string; last_name: string; email?: string | null; phone?: string | null }
) {
  const firstName = data.first_name.trim().toLowerCase();
  const lastName = data.last_name.trim().toLowerCase();

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, preferred_name, email, phone, status")
    .eq("status", "active");

  if (data.email) {
    const email = data.email.trim().toLowerCase();
    query = query.or(
      `email.ilike.${email},and(first_name.ilike.${firstName},last_name.ilike.${lastName})`
    );
  } else {
    query = query.ilike("first_name", firstName).ilike("last_name", lastName);
  }

  return query.limit(10);
}

// ────────────────────────────────────────────────────────────
// CRM dedup: match by email_normalized OR phone_normalized
// ------------------------------------------------------------
// Returns up to two contacts: one matched by email, one by phone.
// When both keys hit the SAME contact, only that contact comes
// back. Caller uses the result to decide: create new, merge, or
// queue for manual review (the email-A / phone-B conflict).
// ────────────────────────────────────────────────────────────

export type DedupMatch = {
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    email_normalized: string | null;
    phone_normalized: string | null;
  };
  matched_on: ("email" | "phone")[];
};

export async function findDedupMatches(
  supabase: Client,
  keys: { emailNormalized: string | null; phoneNormalized: string | null }
): Promise<{ data: DedupMatch[] | null; error: unknown }> {
  const { emailNormalized, phoneNormalized } = keys;
  if (!emailNormalized && !phoneNormalized) {
    return { data: [], error: null };
  }

  const orClauses: string[] = [];
  if (emailNormalized) orClauses.push(`email_normalized.eq.${emailNormalized}`);
  if (phoneNormalized) orClauses.push(`phone_normalized.eq.${phoneNormalized}`);

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, email_normalized, phone_normalized"
    )
    .or(orClauses.join(","))
    .limit(2);

  if (error || !data) return { data: null, error };

  const matches: DedupMatch[] = data.map((row: DedupMatch["contact"]) => {
    const matchedOn: ("email" | "phone")[] = [];
    if (emailNormalized && row.email_normalized === emailNormalized) matchedOn.push("email");
    if (phoneNormalized && row.phone_normalized === phoneNormalized) matchedOn.push("phone");
    return { contact: row, matched_on: matchedOn };
  });

  return { data: matches, error: null };
}

export async function assignPersonType(
  supabase: Client,
  contactId: string,
  personTypeId: string
) {
  return supabase
    .from("person_type_assignments")
    .insert({ contact_id: contactId, person_type_id: personTypeId })
    .select()
    .single();
}

export async function removePersonType(
  supabase: Client,
  contactId: string,
  personTypeId: string
) {
  return supabase
    .from("person_type_assignments")
    .delete()
    .eq("contact_id", contactId)
    .eq("person_type_id", personTypeId);
}

export async function assignTag(
  supabase: Client,
  contactId: string,
  tagId: string
) {
  return supabase
    .from("person_tags")
    .insert({ contact_id: contactId, tag_id: tagId });
}

export async function removeTag(
  supabase: Client,
  contactId: string,
  tagId: string
) {
  return supabase
    .from("person_tags")
    .delete()
    .eq("contact_id", contactId)
    .eq("tag_id", tagId);
}

export async function getPersonTypes(supabase: Client) {
  return supabase.from("person_types").select("*").order("name");
}

export async function getTags(supabase: Client) {
  return supabase.from("tags").select("*").order("name");
}

export async function createTag(
  supabase: Client,
  data: { name: string; category?: string }
) {
  return supabase.from("tags").insert(data).select().single();
}
