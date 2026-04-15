"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { toast } from "sonner";

interface UserLabel {
  id: string;
  name: string;
  category: string;
}

interface UserResult {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
}

interface MemberPickerProps {
  slotId: string;
  userId: string;
  existingMemberIds: string[];
  onAdd: (member: {
    id: string;
    user_id: string;
    role: string;
    instrument: string | null;
    users: { id: string; first_name: string; last_name: string; preferred_name: string | null };
  }) => void;
  onClose: () => void;
}

function displayName(u: { first_name: string; last_name: string; preferred_name: string | null }) {
  const name = u.preferred_name || u.first_name;
  return `${name} ${u.last_name}`;
}

export default function MemberPicker({
  slotId,
  userId,
  existingMemberIds,
  onAdd,
  onClose,
}: MemberPickerProps) {
  const [labels, setLabels] = useState<UserLabel[]>([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("musician");
  const [instrument, setInstrument] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  // Fetch only prayer room relevant labels (ministry_role + instrument)
  useEffect(() => {
    Promise.all([
      fetch("/api/user-labels?category=ministry_role").then((r) => r.json()),
      fetch("/api/user-labels?category=instrument").then((r) => r.json()),
    ])
      .then(([roles, instruments]) => {
        const all = [
          ...(Array.isArray(roles) ? roles : []),
          ...(Array.isArray(instruments) ? instruments : []),
        ];
        setLabels(all);
        // Auto-select the first label to immediately show people
        if (all.length > 0) setSelectedLabel(all[0].id);
      })
      .catch(() => {});
  }, []);

  // Fetch users by label
  useEffect(() => {
    if (!selectedLabel) {
      setUsers([]);
      return;
    }

    fetch(`/api/user-labels?action=users_with_label&labelId=${selectedLabel}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped: UserResult[] = data
            .filter((d: Record<string, unknown>) => d.users)
            .map((d: { users: UserResult }) => d.users);
          setUsers(mapped);
        }
      })
      .catch(() => {});
  }, [selectedLabel]);

  // Auto-set role based on selected label
  useEffect(() => {
    if (!selectedLabel || labels.length === 0) return;
    const label = labels.find((l) => l.id === selectedLabel);
    if (!label) return;

    if (label.category === "ministry_role") {
      // Map label name to role
      if (label.name.toLowerCase().includes("worship")) {
        setRole("worship_leader");
      } else if (label.name.toLowerCase().includes("prayer")) {
        setRole("prayer_leader");
      }
      setInstrument("");
    } else if (label.category === "instrument") {
      setRole("musician");
      setInstrument(label.name);
    }
  }, [selectedLabel, labels]);

  const filteredUsers = users.filter((u) => {
    if (existingMemberIds.includes(u.id)) return false;
    if (!search) return true;
    const full = `${u.first_name} ${u.last_name} ${u.preferred_name ?? ""} ${u.email}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const handleAdd = async (user: UserResult) => {
    setAdding(user.id);
    try {
      const body: Record<string, unknown> = {
        slot_id: slotId,
        user_id: user.id,
        role,
      };
      if (role === "musician" && instrument) {
        body.instrument = instrument;
      }

      const res = await fetch("/api/prayer-room/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add member");
      }

      const newMember = await res.json();
      onAdd({
        id: newMember.id,
        user_id: user.id,
        role,
        instrument: role === "musician" ? instrument || null : null,
        users: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          preferred_name: user.preferred_name,
        },
      });
      toast.success(`${displayName(user)} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(null);
    }
  };

  const instrumentLabels = labels.filter((l) => l.category === "instrument");
  const roleLabels = labels.filter((l) => l.category === "ministry_role");

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Add Team Member</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Browse by Label — shown as filter tabs */}
        <div className="space-y-1">
          <Label className="text-xs">Find people by skill</Label>
          <div className="flex flex-wrap gap-1">
            {roleLabels.map((l) => (
              <Badge
                key={l.id}
                variant={selectedLabel === l.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedLabel(l.id)}
              >
                {l.name}
              </Badge>
            ))}
            {instrumentLabels.length > 0 && roleLabels.length > 0 && (
              <span className="text-muted-foreground text-xs self-center px-1">|</span>
            )}
            {instrumentLabels.map((l) => (
              <Badge
                key={l.id}
                variant={selectedLabel === l.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedLabel(l.id)}
              >
                {l.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Role & Instrument (auto-set but editable) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Assign as</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worship_leader">Worship Leader</SelectItem>
                <SelectItem value="prayer_leader">Prayer Leader</SelectItem>
                <SelectItem value="musician">Musician</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "musician" && (
            <div className="space-y-1">
              <Label className="text-xs">Instrument</Label>
              <Select value={instrument} onValueChange={setInstrument}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {instrumentLabels.map((l) => (
                    <SelectItem key={l.id} value={l.name}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Search + User List */}
        <Input
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-60 overflow-y-auto space-y-1">
          {!selectedLabel ? (
            <p className="text-sm text-muted-foreground py-2">
              Select a skill above to browse available people.
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {users.length === 0
                ? "No one has this label yet."
                : "All matching people are already on the team."}
            </p>
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between py-2 px-2 rounded hover:bg-accent"
              >
                <div>
                  <span className="text-sm font-medium">{displayName(u)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={adding === u.id}
                  onClick={() => handleAdd(u)}
                >
                  {adding === u.id ? "Adding..." : "Add"}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
