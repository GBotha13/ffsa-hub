import type { TablesInsert, TablesUpdate } from "@/types/database";

type LabelInsert = TablesInsert<"labels">;
type LabelUpdate = TablesUpdate<"labels">;
type ContactLabelInsert = TablesInsert<"contact_labels">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// Labels
// ────────────────────────────────────────────────────────────

export async function getLabels(
  supabase: Client,
  options?: {
    active?: boolean;
    category?: string;
    search?: string;
  }
) {
  let query = supabase
    .from("labels")
    .select("*, sending_identities(slug, display_name, from_email)")
    .order("name");

  if (options?.active !== undefined) {
    query = query.eq("is_active", options.active);
  }
  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(`name.ilike.${term},slug.ilike.${term},description.ilike.${term}`);
  }

  return query;
}

export async function getLabelBySlug(supabase: Client, slug: string) {
  return supabase
    .from("labels")
    .select("*, sending_identities(slug, display_name, from_email)")
    .eq("slug", slug)
    .maybeSingle();
}

export async function getLabelById(supabase: Client, id: string) {
  return supabase
    .from("labels")
    .select("*, sending_identities(slug, display_name, from_email)")
    .eq("id", id)
    .maybeSingle();
}

export async function createLabel(supabase: Client, data: LabelInsert) {
  return supabase.from("labels").insert(data).select().single();
}

export async function updateLabel(supabase: Client, id: string, data: LabelUpdate) {
  return supabase.from("labels").update(data).eq("id", id).select().single();
}

export async function deactivateLabel(supabase: Client, id: string) {
  return supabase.from("labels").update({ is_active: false }).eq("id", id).select().single();
}

// ────────────────────────────────────────────────────────────
// Contact ↔ Label assignments
// ────────────────────────────────────────────────────────────

export async function getContactLabels(supabase: Client, contactId: string) {
  return supabase
    .from("contact_labels")
    .select("added_at, added_via, labels(id, slug, name, category, color, is_active)")
    .eq("contact_id", contactId)
    .order("added_at", { ascending: false });
}

export async function getLabelContacts(
  supabase: Client,
  labelId: string,
  options?: { limit?: number; offset?: number }
) {
  let query = supabase
    .from("contact_labels")
    .select("added_at, added_via, contacts(id, first_name, last_name, email, phone)", {
      count: "exact",
    })
    .eq("label_id", labelId)
    .order("added_at", { ascending: false });

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}

export async function addLabelToContact(supabase: Client, data: ContactLabelInsert) {
  return supabase
    .from("contact_labels")
    .upsert(data, { onConflict: "contact_id,label_id", ignoreDuplicates: true })
    .select()
    .maybeSingle();
}

export async function removeLabelFromContact(
  supabase: Client,
  contactId: string,
  labelId: string
) {
  // The 046 trigger writes an unsubscribes row automatically.
  return supabase
    .from("contact_labels")
    .delete()
    .eq("contact_id", contactId)
    .eq("label_id", labelId);
}

// ────────────────────────────────────────────────────────────
// Find-or-create (used by CSV imports + form submissions when
// custom_label_allowed = true)
// ────────────────────────────────────────────────────────────

export async function findOrCreateLabel(
  supabase: Client,
  args: { slug: string; name: string; createdBy?: string | null; category?: string | null }
) {
  const existing = await getLabelBySlug(supabase, args.slug);
  if (existing.data) return existing;

  return createLabel(supabase, {
    slug: args.slug,
    name: args.name,
    category: args.category ?? null,
    is_preset: false,
    is_active: true,
    created_by: args.createdBy ?? null,
  });
}
