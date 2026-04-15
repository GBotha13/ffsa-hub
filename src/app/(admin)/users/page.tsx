import { createClient } from "@/lib/supabase/server";
import { getUsers } from "@/services/users";
import { UsersTable } from "./users-table";
import { InviteUserForm } from "./invite-user-form";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users, count, error: usersError } = await getUsers(supabase);
  if (usersError) {
    console.error("getUsers error:", JSON.stringify(usersError, null, 2));
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Check if current user is super_admin
  let isSuperAdmin = false;
  if (authUser) {
    const { data: superCheck } = await supabase
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", authUser.id)
      .eq("roles.name", "super_admin")
      .limit(1);
    isSuperAdmin = (superCheck?.length ?? 0) > 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {count ?? 0} user accounts
          </p>
        </div>
        {isSuperAdmin && <InviteUserForm />}
      </div>

      <UsersTable users={users ?? []} currentUserId={authUser?.id ?? ""} />
    </div>
  );
}
