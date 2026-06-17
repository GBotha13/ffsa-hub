import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  callerCanManageRoles,
  callerCanGrantPermissionKeys,
} from "@/lib/auth/check-role-grant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const adminSupabase = createAdminClient();
  const { data: role } = await adminSupabase
    .from("roles")
    .select("id, name, is_system")
    .eq("id", id)
    .single();
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  if (role.is_system) {
    return NextResponse.json(
      { error: "System roles cannot be edited here" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { display_name, description, permission_ids } = body as {
    display_name?: string;
    description?: string | null;
    permission_ids?: string[];
  };

  // Update name/description if provided
  const updates: Record<string, unknown> = {};
  if (typeof display_name === "string" && display_name.trim()) {
    updates.display_name = display_name.trim();
  }
  if (description !== undefined) updates.description = description;
  if (Object.keys(updates).length > 0) {
    const { error } = await adminSupabase.from("roles").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace the capability bundle if provided
  if (Array.isArray(permission_ids)) {
    const { data: permRows } = await adminSupabase
      .from("permissions")
      .select("key")
      .in("id", permission_ids);
    const keys = ((permRows ?? []) as { key: string }[]).map((p) => p.key);
    if (!(await callerCanGrantPermissionKeys(supabase, authUser.id, keys))) {
      return NextResponse.json(
        { error: "You can only include capabilities you hold" },
        { status: 403 }
      );
    }
    // role_permissions isn't in the generated DB types until 089's types are
    // regenerated; cast for those calls (matches the codebase pattern).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = adminSupabase as any;
    await adminAny.from("role_permissions").delete().eq("role_id", id);
    if (permission_ids.length > 0) {
      const { error } = await adminAny
        .from("role_permissions")
        .insert(permission_ids.map((pid) => ({ role_id: id, permission_id: pid })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "update",
    resource_type: "roles",
    resource_id: id,
    changes: {
      updated: Object.keys(updates),
      permissions_set: Array.isArray(permission_ids),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const adminSupabase = createAdminClient();
  const { data: role } = await adminSupabase
    .from("roles")
    .select("id, name, is_system")
    .eq("id", id)
    .single();
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  if (role.is_system) {
    return NextResponse.json(
      { error: "System roles cannot be deleted" },
      { status: 400 }
    );
  }

  const { error } = await adminSupabase
    .from("roles")
    .delete()
    .eq("id", id)
    .eq("is_system", false);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await adminSupabase.from("audit_logs").insert({
    user_id: authUser.id,
    action: "delete",
    resource_type: "roles",
    resource_id: id,
    changes: { name: role.name },
  });

  return NextResponse.json({ success: true });
}
