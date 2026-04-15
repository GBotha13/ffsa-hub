import type { Database, UserUpdate } from "@/types/database";

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

/** Mark onboarding as complete by setting accepted_at unconditionally. */
export async function completeOnboarding(supabase: Client, userId: string) {
  return supabase
    .from("users")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
}
