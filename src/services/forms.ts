import type { TablesInsert, TablesUpdate } from "@/types/database";

type FormInsert = TablesInsert<"forms">;
type FormUpdate = TablesUpdate<"forms">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// Forms
// ────────────────────────────────────────────────────────────

export async function listFormsForEvent(supabase: Client, eventId: string) {
  return supabase
    .from("forms")
    .select("id, slug, name, is_active, records_attendance, created_at, label_id")
    .eq("event_id", eventId)
    .order("created_at");
}

export async function getFormById(supabase: Client, id: string) {
  return supabase
    .from("forms")
    .select("*, events(id, title), labels(id, slug, name, color)")
    .eq("id", id)
    .maybeSingle();
}

export async function getFormBySlug(supabase: Client, slug: string) {
  return supabase
    .from("forms")
    .select("*, events(id, title), labels(id, slug, name)")
    .eq("slug", slug)
    .maybeSingle();
}

export async function createForm(supabase: Client, data: FormInsert) {
  return supabase.from("forms").insert(data).select().single();
}

export async function updateForm(supabase: Client, id: string, data: FormUpdate) {
  return supabase.from("forms").update(data).eq("id", id).select().single();
}

export async function deleteForm(supabase: Client, id: string) {
  return supabase.from("forms").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// Slug generation — unique, derived from the form name
// ────────────────────────────────────────────────────────────

export async function generateUniqueFormSlug(
  supabase: Client,
  name: string
): Promise<string> {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "form";

  let candidate = base;
  let n = 1;
  // Loop until the slug is free.
  for (;;) {
    const { data } = await supabase
      .from("forms")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}
