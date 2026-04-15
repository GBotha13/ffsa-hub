"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import MemberPicker from "./member-picker";

interface SlotMember {
  id: string;
  user_id: string;
  role: string;
  instrument: string | null;
  users: { id: string; first_name: string; last_name: string; preferred_name: string | null };
}

interface Slot {
  id: string;
  series_id: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  status: string;
  notes: string | null;
  color: string | null;
  members: SlotMember[];
}

interface SlotDetailProps {
  slot: Slot;
  userId: string;
  isAdmin: boolean;
  onBack: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  worship_leader: "Worship Leader",
  prayer_leader: "Prayer Leader",
  musician: "Musician",
};

const ROLE_COLORS: Record<string, string> = {
  worship_leader: "bg-purple-100 text-purple-800",
  prayer_leader: "bg-blue-100 text-blue-800",
  musician: "bg-green-100 text-green-800",
};

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function displayName(u: { first_name: string; last_name: string; preferred_name: string | null }) {
  const name = u.preferred_name || u.first_name;
  return `${name} ${u.last_name}`;
}

const SLOT_COLOR_OPTIONS = [
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500" },
  { value: "indigo", label: "Indigo", class: "bg-indigo-500" },
  { value: "rose", label: "Rose", class: "bg-rose-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "emerald", label: "Emerald", class: "bg-emerald-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
];

export default function SlotDetail({ slot, userId, isAdmin, onBack }: SlotDetailProps) {
  const [members, setMembers] = useState<SlotMember[]>(slot.members);
  const [showPicker, setShowPicker] = useState(false);
  const [slotColor, setSlotColor] = useState<string | null>(slot.color);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Check if current user is a leader on this slot
  const myMembership = members.find((m) => m.user_id === userId);
  const isSlotLeader = myMembership?.role === "worship_leader" || myMembership?.role === "prayer_leader";
  const canManageTeam = isAdmin || isSlotLeader;

  const handleDeleteSlot = async () => {
    try {
      const res = await fetch(`/api/prayer-room/slots?id=${slot.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete slot");
      toast.success("Slot deleted");
      onBack();
    } catch {
      toast.error("Failed to delete slot");
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    try {
      const res = await fetch(
        `/api/prayer-room/members?slotId=${slot.id}&userId=${memberUserId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleMemberAdded = (newMember: SlotMember) => {
    setMembers((prev) => [...prev, newMember]);
    setShowPicker(false);
  };

  const dateStr = new Date(slot.slot_date + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Group members by role
  const grouped: Record<string, SlotMember[]> = {
    worship_leader: [],
    prayer_leader: [],
    musician: [],
  };
  for (const m of members) {
    if (grouped[m.role]) grouped[m.role].push(m);
    else grouped[m.role] = [m];
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Schedule
      </Button>

      <div>
        <h2 className="text-xl font-bold">{slot.title || "Devo Set"}</h2>
        <p className="text-muted-foreground">
          {dateStr} &middot; {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
        </p>
        <Badge variant={slot.status === "completed" ? "default" : "secondary"} className="mt-1">
          {slot.status}
        </Badge>
      </div>

      {/* Color Picker */}
      {isAdmin && (
        <div>
          <h3 className="font-semibold mb-2">Calendar Color</h3>
          <div className="flex flex-wrap gap-2">
            {SLOT_COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                className={`w-8 h-8 rounded-full ${c.class} transition-all ${
                  slotColor === c.value
                    ? "ring-2 ring-offset-2 ring-primary scale-110"
                    : "hover:scale-110 opacity-70 hover:opacity-100"
                }`}
                title={c.label}
                onClick={async () => {
                  setSlotColor(c.value);
                  try {
                    await fetch("/api/prayer-room/slots", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: slot.id, color: c.value }),
                    });
                    toast.success(`Color set to ${c.label}`);
                  } catch {
                    toast.error("Failed to update color");
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Team Roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Team Roster</h3>
          {canManageTeam && (
            <Button size="sm" variant="outline" onClick={() => setShowPicker(true)} className="gap-1">
              <UserPlus className="h-4 w-4" /> Add Member
            </Button>
          )}
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
        ) : (
          Object.entries(grouped).map(([role, roleMembers]) => {
            if (roleMembers.length === 0) return null;
            return (
              <div key={role}>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {ROLE_LABELS[role] || role}
                </div>
                <div className="space-y-1">
                  {roleMembers.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {displayName(m.users)}
                          </span>
                          <Badge className={`text-xs ${ROLE_COLORS[m.role] ?? ""}`}>
                            {ROLE_LABELS[m.role] || m.role}
                          </Badge>
                          {m.instrument && (
                            <Badge variant="outline" className="text-xs">
                              {m.instrument}
                            </Badge>
                          )}
                        </div>
                        {canManageTeam && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(m.id, m.user_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Show gaps */}
        {members.length > 0 && (
          <div className="text-sm text-muted-foreground space-y-0.5">
            {!grouped.worship_leader.length && (
              <div className="text-orange-500">No worship leader assigned</div>
            )}
            {!grouped.prayer_leader.length && (
              <div className="text-orange-500">No prayer leader assigned</div>
            )}
            {!grouped.musician.length && (
              <div className="text-orange-500">No musicians assigned</div>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      {slot.notes && (
        <div>
          <h3 className="font-semibold mb-1">Devo Notes</h3>
          <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">{slot.notes}</div>
        </div>
      )}

      {/* Delete Slot */}
      {isAdmin && (
        <div className="pt-4 border-t">
          {!confirmDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" /> Delete Slot
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive font-medium">Are you sure?</span>
              <Button variant="destructive" size="sm" onClick={handleDeleteSlot}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Member Picker Dialog */}
      {showPicker && (
        <MemberPicker
          slotId={slot.id}
          userId={userId}
          existingMemberIds={members.map((m) => m.user_id)}
          onAdd={handleMemberAdded}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
