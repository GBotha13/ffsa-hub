"use client";

import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fullName, type Person } from "./helpers";

interface Member {
  user_id: string;
  user: Person;
  skills: { id: string; name: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-filter candidates to a specific skill (e.g. the slot's required label). */
  requiredLabelId?: string | null;
  title?: string;
  busyId?: string | null;
  onPick: (userId: string, member: Member) => void;
  /** The button on each row. "Invite" for seats; practice says "Add". */
  actionLabel?: string;
  /** People already chosen, left out of the list. */
  excludeIds?: string[];
}

export default function MemberPicker({
  open,
  onClose,
  requiredLabelId,
  title,
  busyId,
  onPick,
  actionLabel = "Invite",
  excludeIds = [],
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "active" });
      if (requiredLabelId) params.set("labelId", requiredLabelId);
      const res = await fetch(`/api/prayer-room/members?${params}`);
      setMembers(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [requiredLabelId]);

  useEffect(() => {
    if (open) {
      setSearch("");
      load();
    }
  }, [open, load]);

  const filtered = members.filter((m) => {
    if (excludeIds.includes(m.user_id)) return false;
    if (!search) return true;
    return fullName(m.user).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || "Invite someone"}</DialogTitle>
        </DialogHeader>

        <Input placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No active members{requiredLabelId ? " with this skill" : ""} yet.
            </p>
          ) : (
            filtered.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between rounded px-2 py-2 hover:bg-accent">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{fullName(m.user)}</div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {m.skills.slice(0, 4).map((s) => (
                      <Badge key={s.id} variant="outline" className="text-[10px]">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={busyId === m.user_id} onClick={() => onPick(m.user_id, m)}>
                  {busyId === m.user_id ? "…" : actionLabel}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
