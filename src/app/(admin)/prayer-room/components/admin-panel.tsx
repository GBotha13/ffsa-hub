"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AdminPanelProps {
  userId: string;
}

interface Series {
  id: string;
  commitment_type: string;
  title: string | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  users: { id: string; first_name: string; last_name: string; preferred_name: string | null };
}

interface UserLabel {
  id: string;
  name: string;
  category: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COMMITMENT_LABELS: Record<string, string> = {
  one_off: "One-Off",
  weekly: "Weekly",
  quarterly: "Quarterly",
};

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function displayName(u: { first_name: string; last_name: string; preferred_name: string | null }) {
  return (u.preferred_name || u.first_name) + " " + u.last_name;
}

export default function AdminPanel({ userId }: AdminPanelProps) {
  const [adminTab, setAdminTab] = useState("pending");

  return (
    <div>
      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending Requests</TabsTrigger>
          <TabsTrigger value="labels">Labels</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingRequests userId={userId} />
        </TabsContent>

        <TabsContent value="labels">
          <LabelsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Pending Requests ───────────────────────────────────────

function PendingRequests({ userId }: { userId: string }) {
  const [pending, setPending] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prayer-room/series?status=pending");
      if (res.ok) setPending(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch("/api/prayer-room/series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast.success("Series approved — slots have been generated!");
      fetchPending();
    } catch {
      toast.error("Failed to approve series");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch("/api/prayer-room/series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "reject",
          rejection_reason: rejectReason.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toast.success("Series rejected");
      setRejectingId(null);
      setRejectReason("");
      fetchPending();
    } catch {
      toast.error("Failed to reject series");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (pending.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No pending sign-up requests.</p>;
  }

  return (
    <div className="space-y-3 mt-2">
      {pending.map((s) => (
        <Card key={s.id}>
          <CardContent className="py-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">
                  {s.title || "Untitled Devo Set"}
                </div>
                <div className="text-sm text-muted-foreground">
                  by {displayName(s.users)} &middot;{" "}
                  <Badge variant="outline" className="text-xs">
                    {COMMITMENT_LABELS[s.commitment_type] || s.commitment_type}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {s.commitment_type !== "one_off" && s.day_of_week !== null
                    ? `${DAY_NAMES[s.day_of_week]}s, `
                    : ""}
                  {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  {" · "}
                  {s.start_date}
                  {s.end_date ? ` → ${s.end_date}` : s.commitment_type !== "one_off" ? " (ongoing)" : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600"
                  onClick={() => handleApprove(s.id)}
                >
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  onClick={() =>
                    setRejectingId(rejectingId === s.id ? null : s.id)
                  }
                >
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>

            {rejectingId === s.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (optional)..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleReject(s.id)}>
                    Confirm Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Labels Manager ─────────────────────────────────────────

function LabelsManager() {
  const [labels, setLabels] = useState<UserLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("instrument");

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user-labels");
      if (res.ok) setLabels(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/user-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), category: newCategory }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create label");
      }
      toast.success(`Label "${newName.trim()}" created`);
      setNewName("");
      fetchLabels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const handleDelete = async (label: UserLabel) => {
    if (!confirm(`Delete label "${label.name}"? This will remove it from all users.`)) return;

    try {
      const res = await fetch(`/api/user-labels?id=${label.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(`Label "${label.name}" deleted`);
      fetchLabels();
    } catch {
      toast.error("Failed to delete label");
    }
  };

  const grouped: Record<string, UserLabel[]> = {};
  for (const l of labels) {
    if (!grouped[l.category]) grouped[l.category] = [];
    grouped[l.category].push(l);
  }

  const CATEGORY_LABELS: Record<string, string> = {
    ministry_role: "Ministry Roles",
    instrument: "Instruments",
    other: "Other",
  };

  return (
    <div className="space-y-6 mt-2">
      {/* Create Label */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create Label</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Violin"
              />
            </div>
            <div className="w-48 space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ministry_role">Ministry Role</SelectItem>
                  <SelectItem value="instrument">Instrument</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Labels */}
      {loading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : (
        Object.entries(grouped).map(([cat, catLabels]) => (
          <div key={cat}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              {CATEGORY_LABELS[cat] || cat}
            </h4>
            <div className="flex flex-wrap gap-2">
              {catLabels.map((l) => (
                <Badge key={l.id} variant="secondary" className="gap-1 py-1 px-2">
                  {l.name}
                  <button
                    onClick={() => handleDelete(l)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
