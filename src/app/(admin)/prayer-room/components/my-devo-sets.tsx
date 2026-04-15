"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SlotData {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  status: string;
  notes: string | null;
  completed_at: string | null;
  series: { commitment_type: string } | null;
}

interface MemberSlot {
  id: string;
  user_id: string;
  role: string;
  instrument: string | null;
  slot: SlotData;
}

interface MyDevoSetsProps {
  userId: string;
}

const ROLE_LABELS: Record<string, string> = {
  worship_leader: "Worship Leader",
  prayer_leader: "Prayer Leader",
  musician: "Musician",
};

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MyDevoSets({ userId }: MyDevoSetsProps) {
  const [upcoming, setUpcoming] = useState<MemberSlot[]>([]);
  const [past, setPast] = useState<MemberSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const fetchSets = useCallback(async () => {
    setLoading(true);
    try {
      const [upRes, allRes] = await Promise.all([
        fetch(`/api/prayer-room/slots?mySlots=true&upcoming=true&userId=${userId}`),
        fetch(`/api/prayer-room/slots?mySlots=true&userId=${userId}`),
      ]);

      if (upRes.ok) setUpcoming(await upRes.json());
      if (allRes.ok) {
        const all: MemberSlot[] = await allRes.json();
        const today = new Date().toISOString().split("T")[0];
        setPast(
          all.filter(
            (s) => s.slot.slot_date < today || s.slot.status === "completed"
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const handleComplete = async (slotId: string) => {
    try {
      const res = await fetch("/api/prayer-room/slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: slotId,
          status: "completed",
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to complete slot");
      toast.success("Devo set marked as completed!");
      setCompletingId(null);
      setNotes("");
      fetchSets();
    } catch {
      toast.error("Failed to complete devo set");
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading your devo sets...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re not assigned to any upcoming devo sets.
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((ms) => (
              <Card key={ms.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {ms.slot.title || "Devo Set"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(ms.slot.slot_date)} &middot;{" "}
                      {formatTime(ms.slot.start_time)} – {formatTime(ms.slot.end_time)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {ROLE_LABELS[ms.role] || ms.role}
                    </Badge>
                    {ms.instrument && (
                      <Badge variant="outline">{ms.instrument}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Past Sets</h3>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past devo sets yet.</p>
        ) : (
          <div className="space-y-2">
            {past.map((ms) => (
              <Card key={ms.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {ms.slot.title || "Devo Set"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(ms.slot.slot_date)} &middot;{" "}
                        {formatTime(ms.slot.start_time)} – {formatTime(ms.slot.end_time)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={ms.slot.status === "completed" ? "default" : "secondary"}
                      >
                        {ms.slot.status === "completed" ? "Completed" : "Scheduled"}
                      </Badge>
                      {ms.slot.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCompletingId(ms.slot.id)}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>

                  {ms.slot.notes && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      {ms.slot.notes}
                    </div>
                  )}

                  {completingId === ms.slot.id && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add devo notes (optional)..."
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleComplete(ms.slot.id)}>
                          Save & Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCompletingId(null);
                            setNotes("");
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
        )}
      </div>
    </div>
  );
}
