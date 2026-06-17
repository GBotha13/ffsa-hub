"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import SetDetail from "./set-detail";
import { DAYS_SHORT, fullName, formatTimeRange, toISODate, weekStartDate, addDays, type Person } from "./helpers";

interface SetSlot {
  id: string;
  role: string;
  status: string;
}
interface SetRow {
  id: string;
  set_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  theme: string | null;
  status: string;
  owner: Person;
  slots: SetSlot[];
}

interface Props {
  userId: string;
  isStaff: boolean;
  isMember: boolean;
}

export default function ScheduleView({ userId, isStaff, isMember }: Props) {
  const [weekStart, setWeekStart] = useState(() => weekStartDate(new Date()));
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const todayStr = toISODate(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prayer-room/sets?dateFrom=${toISODate(weekStart)}&dateTo=${toISODate(weekEnd)}`);
      setSets(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateWeek() {
    setBusy(true);
    try {
      const res = await fetch("/api/prayer-room/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: toISODate(weekStart) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(data.created > 0 ? `Created ${data.created} set${data.created === 1 ? "" : "s"}` : "This week is already up to date");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const setsByDay: Record<string, SetRow[]> = {};
  days.forEach((d) => (setsByDay[d] = []));
  sets.forEach((s) => setsByDay[s.set_date]?.push(s));

  return (
    <div>
      {/* Week nav + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(weekStartDate(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 text-sm font-medium">
            {weekStart.toLocaleDateString("en-ZA", { month: "short", day: "numeric" })} –{" "}
            {weekEnd.toLocaleDateString("en-ZA", { month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <Button variant="outline" size="sm" className="gap-1" disabled={busy} onClick={generateWeek}>
              <CalendarPlus className="h-4 w-4" /> Generate week
            </Button>
          )}
          {(isMember || isStaff) && (
            <Button size="sm" className="gap-1" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New set
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-20 text-center text-muted-foreground">Loading schedule…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-2">
          {days.map((d, i) => {
            const isToday = d === todayStr;
            return (
              <div key={d} className="min-w-0">
                <div className={`mb-2 rounded-md px-2 py-1 text-center ${isToday ? "bg-primary/10" : ""}`}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{DAYS_SHORT[i]}</div>
                  <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {new Date(d + "T00:00:00").getDate()}
                  </div>
                </div>
                <div className="space-y-2">
                  {setsByDay[d].length === 0 ? (
                    <p className="px-1 text-center text-[11px] text-muted-foreground/60">—</p>
                  ) : (
                    setsByDay[d].map((s) => <SetCard key={s.id} set={s} onClick={() => setSelectedId(s.id)} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SetDetail
        setId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        userId={userId}
        isStaff={isStaff}
        onChanged={load}
      />

      <CreateSetDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaultDate={toISODate(weekStart)}
        onCreated={async (id) => {
          setCreating(false);
          await load();
          setSelectedId(id); // open the new set so they can build the roster
        }}
      />
    </div>
  );
}

function SetCard({ set, onClick }: { set: SetRow; onClick: () => void }) {
  const total = set.slots.length;
  const filled = set.slots.filter((s) => s.status === "filled").length;
  const open = set.slots.filter((s) => s.status === "open").length;
  const cancelled = set.status === "cancelled";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-accent ${
        cancelled ? "opacity-50" : ""
      }`}
    >
      <div className="text-xs font-semibold leading-tight">{formatTimeRange(set.start_time, set.end_time)}</div>
      <div className="truncate text-[13px] font-medium leading-tight">{set.title || set.theme || "Devo set"}</div>
      {set.owner && <div className="truncate text-[11px] text-muted-foreground">{fullName(set.owner)}</div>}
      <div className="mt-1 flex items-center gap-1.5">
        {total > 0 ? (
          <>
            <span className="text-[10px] text-muted-foreground">
              {filled}/{total}
            </span>
            {open > 0 && (
              <Badge variant="outline" className="h-4 border-amber-500/40 px-1 text-[9px] text-amber-400">
                {open} open
              </Badge>
            )}
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">no roster</span>
        )}
      </div>
    </button>
  );
}

function CreateSetDialog({
  open,
  onClose,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  onCreated: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    setBusy(true);
    try {
      const res = await fetch("/api/prayer-room/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set_date: form.get("set_date"),
          start_time: form.get("start_time"),
          end_time: form.get("end_time"),
          title: form.get("title") || null,
          theme: form.get("theme") || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create set");
      toast.success("Set created — add your roster");
      onCreated(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create set");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New devo set</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" name="set_date" defaultValue={defaultDate} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input type="time" name="start_time" defaultValue="06:00" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Input type="time" name="end_time" defaultValue="08:00" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title (optional)</Label>
            <Input name="title" placeholder="Morning devo" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Theme / focus (optional)</Label>
            <Input name="theme" />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create set"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
