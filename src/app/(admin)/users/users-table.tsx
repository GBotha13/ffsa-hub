"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, ChevronRight } from "lucide-react";
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
  status: string | null;
  job_title: string | null;
  department: string | null;
  last_sign_in_at: string | null;
  user_roles: Array<{
    id: string;
    scope_type: string | null;
    roles: { display_name: string } | null;
  }>;
};

const DEPARTMENT_LABELS: Record<string, string> = {
  prayer_and_worship: "Prayer and Worship",
  media: "Media",
  hulk: "Hulk",
  backbone: "Backbone",
  training: "Training",
  project_54: "Project 54",
  education: "Education",
  woven: "Woven",
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
            <TableHead>Job Title</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Sign In</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-8"
              >
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => router.push(`/users/${user.id}`)}
              >
                <TableCell className="font-medium">
                  {user.display_name ??
                    (user.first_name
                      ? `${user.preferred_name ?? user.first_name} ${user.last_name}`
                      : "—")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.job_title ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.department
                    ? DEPARTMENT_LABELS[user.department] ?? user.department
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      user.status === "active"
                        ? "default"
                        : user.status === "pending_approval"
                        ? "outline"
                        : "secondary"
                    }
                    style={
                      user.status === "pending_approval"
                        ? {
                            borderColor: "hsl(42 95% 55% / 0.4)",
                            color: "hsl(42 95% 60%)",
                            background: "hsl(42 80% 18%)",
                          }
                        : undefined
                    }
                  >
                    {user.status === "active"
                      ? "Active"
                      : user.status === "pending_approval"
                      ? "Pending Approval"
                      : "Invited"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString()
                    : "Never"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
