import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  callerCanManageRoles,
  callerCanGrantPermissionKeys,
} from "@/lib/auth/check-role-grant";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "role"
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await callerCanManageRoles(supabase, authUser.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { display_name, description, permission_ids } = body as {
    display_name?: string;
    description?: string | null;
    permission_ids?: string[];
  };
  if (!display_name || !display_name.trim()) {
    return NextResponse.json({ error: "display_name is required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  // role_permissions isn't in the generated DB types until 089's types are
  // regenerated; cast for those calls (matches the codebase pattern).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = adminSupabase as any;
  const permIds = Array.isArray(permission_ids) ? permission_ids : [];

  // Guardrail: caller can only build a role from capabilities they hold
  if (permIds.length > 0) {
    const { data: permRows } = await adminSupabase
      .from("permissions")
      .select("key")
      .in("id", permIds);
    const keys = ((permRows ?? []) as { key: string }[]).map((p) => p.key);
    if (!(await callerCanGrantPermissionKeys(supabase, authUser.id, keys))) {
      return NextResponse.json(
        { error: "You can only include capabilities you hold" },
        { status: 403 }
      );
    }
  }

  // Derive a unique role name from the display name
  const base = slugify(display_name);
  let name = base;
  for (let i = 2; i < 50; i++) {
    const { data: existing } = await adminSupabase
      .from("roles")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (!existing) break;
    name = `${base}_${i}`;
  }

  const { data: role, error: roleError } = await adminSupabase
    .from("roles")
    .insert({
      name,
      display_name: display_name.trim(),
      description: description ?? null,
      is_system: false,
    })
    .select("id, name, display_name, description, is_system")
    .single();
  if (roleError || !role) {
    return NextResponse.json(
      { error: roleError?.message ?? "Could not create role" },
      { status: 500 }
    );
  }

  if (permIds.length > 0) {
    const { error: rpError } = await adminAny
      .from("role_permissions")
      .insert(permIds.map((pid) => ({ role_id: role.id, permission_id: pid })));
    if (rpError) {
      return NextResponse.json({ error: rpError.message }, { status: 500 });
    }
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "create",
    resource_type: "roles",
    resource_id: role.id,
    changes: {
      name: role.name,
      display_name: role.display_name,
      permission_count: permIds.length,
    },
  });

  return NextResponse.json({ role });
}
