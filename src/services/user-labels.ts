// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// LABELS
// ────────────────────────────────────────────────────────────

export async function getLabels(
  supabase: Client,
  options?: { category?: string }
) {
  let query = supabase
    .from("user_labels")
    .select("*")
    .order("category")
    .order("name");

  if (options?.category) {
    query = query.eq("category", options.category);
  }

  return query;
}

export async function createLabel(
  supabase: Client,
  data: { name: string; category: string }
) {
  return supabase.from("user_labels").insert(data).select().single();
}

export async function deleteLabel(supabase: Client, id: string) {
  return supabase.from("user_labels").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// LABEL ASSIGNMENTS
// ────────────────────────────────────────────────────────────

export async function getUserLabels(supabase: Client, userId: string) {
  return supabase
    .from("user_label_assignments")
    .select("*, user_labels(*)")
    .eq("user_id", userId)
    .order("created_at");
}

export async function getUsersWithLabel(supabase: Client, labelId: string) {
  return supabase
    .from("user_label_assignments")
    .select("*, users(id, first_name, last_name, preferred_name, email)")
    .eq("label_id", labelId);
}

export async function getUsersByLabelName(supabase: Client, labelName: string) {
  return supabase
    .from("user_label_assignments")
    .select("*, user_labels!inner(id, name, category), users(id, first_name, last_name, preferred_name, email)")
    .eq("user_labels.name", labelName);
}

export async function assignLabel(
  supabase: Client,
  data: { user_id: string; label_id: string; assigned_by: string }
) {
  return supabase
    .from("user_label_assignments")
    .insert(data)
    .select("*, user_labels(*)")
    .single();
}

export async function removeLabel(
  supabase: Client,
  userId: string,
  labelId: string
) {
  return supabase
    .from("user_label_assignments")
    .delete()
    .eq("user_id", userId)
    .eq("label_id", labelId);
}

// Bulk fetch labels for multiple users (e.g., for schedule display)
export async function getLabelsForUsers(
  supabase: Client,
  userIds: string[]
) {
  if (userIds.length === 0) return { data: [], error: null };
  return supabase
    .from("user_label_assignments")
    .select("*, user_labels(id, name, category)")
    .in("user_id", userIds);
}
