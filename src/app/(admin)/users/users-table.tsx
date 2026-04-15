"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  is_active: boolean;
  accepted_at: string | null;
  last_sign_in_at: string | null;
  user_roles: Array<{
    id: string;
    scope_type: string | null;
    roles: { display_name: string } | null;
  }>;
};

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(user: UserRow) {
    const name =
      user.display_name ??
      (user.first_name
        ? `${user.preferred_name ?? user.first_name} ${user.last_name}`
        : "this user");

    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) {
      return;
    }

    setDeleting(user.id);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to delete user");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Sign In</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.display_name ??
                    (user.first_name
                      ? `${user.preferred_name ?? user.first_name} ${user.last_name}`
                      : "—")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.user_roles?.map((ur) => (
                      <Badge key={ur.id} variant="secondary" className="text-xs">
                        {ur.roles?.display_name ?? "Unknown"}
                        {ur.scope_type && (
                          <span className="ml-1 opacity-60">
                            ({ur.scope_type})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.is_active ? "default" : "destructive"}
                  >
                    {user.is_active
                      ? user.accepted_at
                        ? "Active"
                        : "Invited"
                      : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString()
                    : "Never"}
                </TableCell>
                <TableCell>
                  {user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(user)}
                      disabled={deleting === user.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
