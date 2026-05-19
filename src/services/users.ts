import type { Database, TablesUpdate } from "@/types/database";
type UserUpdate = TablesUpdate<"users">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function getCurrentUser(supabase: Client) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { data: null, error: null };

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (error) return { data: null, error };

  // Load roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("*, roles(*)")
    .eq("user_id", authUser.id);

  return {
    data: {
      ...data,
      auth_user: authUser,
      user_roles: roles ?? [],
    },
    error: null,
  };
}

export async function getUsers(
  supabase: Client,
  options?: { search?: string; limit?: number; offset?: number }
) {
  let query = supabase
    .from("users")
    .select("*, user_roles!user_roles_user_id_fkey(*, roles(*))", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(
      `display_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`
    );
  }

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}

export async function getUserById(supabase: Client, id: string) {
  return supabase
    .from("users")
    .select("*, user_roles!user_roles_user_id_fkey(*, roles(*))")
    .eq("id", id)
    .single();
}

export async function updateUser(
  supabase: Client,
  id: string,
  data: { display_name?: string; avatar_url?: string; is_active?: boolean }
) {
  return supabase.from("users").update(data).eq("id", id).select().single();
}

export async function updateUserProfile(
  supabase: Client,
  id: string,
  data: Partial<UserUpdate>
) {
  return supabase.from("users").update(data).eq("id", id).select().single();
}

export async function updateLastSignIn(supabase: Client, userId: string) {
  return supabase
    .from("users")
    .update({ last_sign_in_at: new Date().toISOString(), accepted_at: new Date().toISOString() })
    .eq("id", userId)
    .is("accepted_at", null)
    .select()
    .single();
}

/** Mark onboarding as complete — sets pending_approval so super admin can review. */
export async function completeOnboarding(supabase: Client, userId: string) {
  return supabase
    .from("users")
    .update({
      accepted_at: new Date().toISOString(),
      status: "pending_approval",
    })
    .eq("id", userId)
    .select()
    .single();
}

/** Approve a user and activate their account (super_admin only). */
export async function approveUser(
  supabase: Client,
  userId: string,
  approvedBy: string,
  jobTitle?: string,
  isAssignableContact?: boolean
) {
  const update: Record<string, unknown> = { status: "active" };
  if (jobTitle !== undefined) update.job_title = jobTitle;
  if (isAssignableContact !== undefined) update.is_assignable_contact = isAssignableContact;
  return supabase.from("users").update(update).eq("id", userId).select().single();
}

/** Count users currently awaiting approval. */
export async function getPendingApprovalCount(supabase: Client) {
  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_approval");
  return count ?? 0;
}
