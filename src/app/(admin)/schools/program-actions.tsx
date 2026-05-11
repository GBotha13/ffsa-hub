"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";

type ProgramActionProps = {
  program: { id: string; name: string; status: string };
  variant?: "icon" | "button";
  redirectAfterDelete?: boolean;
};

export function ProgramActions({
  program,
  variant = "icon",
  redirectAfterDelete = false,
}: ProgramActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleArchiveRestore() {
    const newStatus = program.status === "active" ? "archived" : "active";
    setLoading(true);

    try {
      const res = await fetch("/api/schools/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: program.id, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update program");
        return;
      }

      toast.success(
        newStatus === "archived"
          ? `"${program.name}" has been archived`
          : `"${program.name}" has been restored`
      );
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);

    try {
      const res = await fetch(`/api/schools/programs?id=${program.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete program");
        return;
      }

      toast.success(`"${program.name}" has been permanently deleted`);
      setDeleteOpen(false);

      if (redirectAfterDelete) {
        router.push("/schools");
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              disabled={loading}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={loading}>
              <MoreHorizontal className="mr-2 h-4 w-4" />
              Actions
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {program.status === "active" ? (
            <DropdownMenuItem onClick={handleArchiveRestore}>
              <Archive className="mr-2 h-4 w-4" />
              Archive Program
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleArchiveRestore}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Restore Program
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Program
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{program.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This will permanently delete this program and all associated data
              including courses, enrollments, grades, applications, and fee
              records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
