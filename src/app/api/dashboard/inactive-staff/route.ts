import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerIsAdmin } from "@/lib/auth/check-ministry-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type InactiveStaffMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  roles: string[];
};

const MEMBERSHIP_ONLY = ["student", "community_member", "self_service"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const isAdmin = await callerIsAdmin(supabase, user.id);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin: Client = createAdminClient();
  const cutoffMs = Date.now() - 90 * 24 * 60 * 60 * 1000;

  // Elevated role IDs
  const { data: elevatedRoleDefs } = await admin
    .from("roles")
    .select("id, name")
    .not("name", "in", `(${MEMBERSHIP_ONLY.join(",")})`);
  const elevatedRoleIds = (elevatedRoleDefs ?? []).map((r: any) => r.id as string);
  if (elevatedRoleIds.length === 0) return NextResponse.json({ staff: [] });

  // User IDs with elevated roles (deduplicated)
  const { data: elevatedUserRows } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role_id", elevatedRoleIds);
  const elevatedUserIds = [
    ...new Set<string>((elevatedUserRows ?? []).map((r: any) => r.user_id as string)),
  ];
  if (elevatedUserIds.length === 0) return NextResponse.json({ staff: [] });

  // Fetch candidate users
  const { data: candidates, error } = await admin
    .from("users")
    .select("id, first_name, last_name, email, last_sign_in_at, created_at")
    .in("id", elevatedUserIds)
    .eq("is_active", true)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inactive = (candidates ?? []).filter((u: any) => {
    const lastSeen = u.last_sign_in_at
      ? new Date(u.last_sign_in_at).getTime()
      : new Date(u.created_at).getTime();
    return lastSeen < cutoffMs;
  });

  if (inactive.length === 0) return NextResponse.json({ staff: [] });

  // Fetch role names for each inactive staff member
  const inactiveIds = inactive.map((u: any) => u.id as string);
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("user_id, roles!inner(name)")
    .in("user_id", inactiveIds)
    .in("role_id", elevatedRoleIds);

  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows ?? []) {
    const uid = row.user_id as string;
    const name = (row.roles as any)?.name as string | undefined;
    if (!name) continue;
    const existing = rolesByUser.get(uid) ?? [];
    existing.push(name);
    rolesByUser.set(uid, existing);
  }

  const staff: InactiveStaffMember[] = inactive.map((u: any) => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
    roles: rolesByUser.get(u.id) ?? [],
  }));

  // Sort: longest-inactive first
  staff.sort((a, b) => {
    const aTs = a.last_sign_in_at
      ? new Date(a.last_sign_in_at).getTime()
      : new Date(a.created_at).getTime();
    const bTs = b.last_sign_in_at
      ? new Date(b.last_sign_in_at).getTime()
      : new Date(b.created_at).getTime();
    return aTs - bTs;
  });

  return NextResponse.json({ staff });
}
