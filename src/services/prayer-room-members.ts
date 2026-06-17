// Prayer Room — approved-member directory + status/role management.
//
// READS that show names use the ADMIN client (names live on `users`, which is
// own-row-or-admin under RLS). Skills come from user_label_assignments and are
// merged in here. Contact details are fetched separately and gated by the route.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

const NAME_FIELDS = "id, first_name, last_name, preferred_name";
const NIL = "00000000-0000-0000-0000-000000000000";

type Skill = { id: string; name: string; category: string };

/** Approved members for the directory, each with their skill labels attached. */
export async function getMembers(
  supabase: Client,
  options?: { status?: string; labelId?: string; search?: string }
) {
  // optional skill filter → restrict to users holding that label
  let userIdFilter: string[] | null = null;
  if (options?.labelId) {
    const { data } = await supabase
      .from("user_label_assignments")
      .select("user_id")
      .eq("label_id", options.labelId);
    const ids: string[] = (data ?? []).map((r: { user_id: string }) => r.user_id);
    if (ids.length === 0) return { data: [], error: null };
    userIdFilter = ids;
  }

  let query = supabase
    .from("prayer_room_members")
    .select(`*, user:user_id(${NAME_FIELDS})`)
    .order("status")
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (userIdFilter) query = query.in("user_id", userIdFilter);

  const { data: members, error } = await query;
  if (error) return { data: null, error };

  const withSkills = await attachSkills(supabase, members ?? []);

  // optional name search (applied after name resolution)
  if (options?.search) {
    const term = options.search.toLowerCase();
    return {
      data: withSkills.filter((m) => {
        const u = m.user;
        if (!u) return false;
        return [u.first_name, u.last_name, u.preferred_name]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(term));
      }),
      error: null,
    };
  }

  return { data: withSkills, error: null };
}

export async function getMemberByUserId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("prayer_room_members")
    .select(`*, user:user_id(${NAME_FIELDS})`)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { data, error };
  const [withSkills] = await attachSkills(supabase, [data]);
  return { data: withSkills, error: null };
}

/** Lightweight membership flags for the current user (status + role flags). */
export async function getMemberFlags(supabase: Client, userId: string) {
  return supabase
    .from("prayer_room_members")
    .select("status, is_evaluator, is_coordinator")
    .eq("user_id", userId)
    .maybeSingle();
}

/** Active members flagged as evaluators — for the "assign evaluator" picker. */
export async function listEvaluators(supabase: Client) {
  return supabase
    .from("prayer_room_members")
    .select(`user_id, is_coordinator, user:user_id(${NAME_FIELDS})`)
    .eq("is_evaluator", true)
    .eq("status", "active")
    .order("created_at");
}

export async function setMemberStatus(supabase: Client, userId: string, status: string) {
  return supabase
    .from("prayer_room_members")
    .update({ status })
    .eq("user_id", userId)
    .select()
    .single();
}

export async function setEvaluator(supabase: Client, userId: string, value: boolean) {
  return supabase
    .from("prayer_room_members")
    .update({ is_evaluator: value })
    .eq("user_id", userId)
    .select()
    .single();
}

export async function setCoordinator(supabase: Client, userId: string, value: boolean) {
  return supabase
    .from("prayer_room_members")
    .update({ is_coordinator: value })
    .eq("user_id", userId)
    .select()
    .single();
}

/**
 * Contact card — sensitive. The ROUTE must confirm the caller is staff or a
 * current set owner before calling this (uses the admin client).
 */
export async function getContactCard(adminClient: Client, userId: string) {
  return adminClient
    .from("users")
    .select("id, first_name, last_name, preferred_name, email, phone")
    .eq("id", userId)
    .single();
}

// ── internal ────────────────────────────────────────────────
type NamePerson = { first_name: string | null; last_name: string | null; preferred_name: string | null } | null;
type MemberRow = { user_id: string; user: NamePerson; [k: string]: unknown };

async function attachSkills(supabase: Client, members: MemberRow[]) {
  const ids = members.map((m) => m.user_id);
  const { data: labels } = await supabase
    .from("user_label_assignments")
    .select("user_id, user_labels(id, name, category)")
    .in("user_id", ids.length ? ids : [NIL]);

  const byUser: Record<string, Skill[]> = {};
  (labels ?? []).forEach((l: { user_id: string; user_labels: Skill | null }) => {
    if (!l.user_labels) return;
    (byUser[l.user_id] ??= []).push(l.user_labels);
  });

  return members.map((m) => ({ ...m, skills: byUser[m.user_id] ?? [] }));
}
