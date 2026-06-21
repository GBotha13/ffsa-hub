"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ROLES,
  roleLabel,
  fullName,
  DAYS_SHORT,
  formatTimeRange,
  APPLICATION_STATUS_LABELS,
  MEMBER_STATUS_LABELS,
  type Person,
} from "./helpers";

export default function AdminPanel() {
  return (
    <Tabs defaultValue="applications">
      <TabsList>
        <TabsTrigger value="applications">Applications</TabsTrigger>
        <TabsTrigger value="template">Template</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>
      <TabsContent value="applications" className="mt-4">
        <ApplicationsManager />
      </TabsContent>
      <TabsContent value="template" className="mt-4">
        <TemplateManager />
      </TabsContent>
      <TabsContent value="members" className="mt-4">
        <MembersManager />
      </TabsContent>
    </Tabs>
  );
}

// ── Applications: assign evaluators ─────────────────────────
interface Application {
  id: string;
  status: string;
  applicant: Person;
  evaluator: Person;
  skills: { label: { id: string; name: string } | null }[];
}
interface Evaluator {
  user_id: string;
  user: Person;
}

function ApplicationsManager() {
  const [apps, setApps] = useState<Application[]>([]);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        fetch("/api/prayer-room/applications?scope=all").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/prayer-room/members?evaluators=true").then((r) => (r.ok ? r.json() : [])),
      ]);
      setApps(a);
      setEvaluators(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(id: string) {
    const evaluatorId = pick[id];
    if (!evaluatorId) return toast.error("Choose an evaluator");
    setBusy(id);
    try {
      const res = await fetch(`/api/prayer-room/applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", evaluator_id: evaluatorId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Evaluator assigned");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  // Manager can decide directly — with or without an evaluator assigned.
  async function decide(id: string, approve: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/prayer-room/applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", approve, decision_note: note[id] || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success(approve ? "Approved — welcome them in!" : "Marked not approved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="py-12 text-center text-muted-foreground">Loading…</p>;

  const pending = apps.filter((a) => a.status === "applied");
  const inProgress = apps.filter((a) => a.status === "assigned" || a.status === "evaluated");
  const decided = apps.filter((a) => a.status === "approved" || a.status === "denied" || a.status === "withdrawn");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Needs an evaluator {pending.length > 0 && <span className="text-primary">({pending.length})</span>}
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting to be assigned.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{fullName(a.applicant)}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.skills.map((s, i) => s.label && <Badge key={i} variant="secondary" className="text-[10px]">{s.label.name}</Badge>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={pick[a.id] ?? ""} onValueChange={(v) => setPick((p) => ({ ...p, [a.id]: v }))}>
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue placeholder="Choose evaluator" />
                      </SelectTrigger>
                      <SelectContent>
                        {evaluators.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No evaluators yet — grant the “Evaluate Prayer Room Applicants” permission to someone.</div>}
                        {evaluators.map((ev) => (
                          <SelectItem key={ev.user_id} value={ev.user_id}>
                            {fullName(ev.user)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={busy === a.id} onClick={() => assign(a.id)}>
                      Assign
                    </Button>
                  </div>
                </div>
                <DecideControls
                  id={a.id}
                  note={note}
                  setNote={setNote}
                  busy={busy === a.id}
                  onDecide={decide}
                  hint="Or decide now — no evaluator needed."
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {inProgress.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">With evaluators</h3>
          <div className="space-y-2">
            {inProgress.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{fullName(a.applicant)}</span>
                  <span className="text-xs text-muted-foreground">
                    {APPLICATION_STATUS_LABELS[a.status]} · {fullName(a.evaluator)}
                  </span>
                </div>
                <DecideControls id={a.id} note={note} setNote={setNote} busy={busy === a.id} onDecide={decide} />
              </div>
            ))}
          </div>
        </section>
      )}

      {decided.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Decided</h3>
          <div className="space-y-1.5">
            {decided.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span>{fullName(a.applicant)}</span>
                <Badge variant={a.status === "approved" ? "default" : "secondary"}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Shared approve/deny control for the manager — usable on any open application.
function DecideControls({
  id,
  note,
  setNote,
  busy,
  onDecide,
  hint,
}: {
  id: string;
  note: Record<string, string>;
  setNote: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: boolean;
  onDecide: (id: string, approve: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Label className="text-xs">Decision note (optional, shared with applicant)</Label>
      <Textarea
        value={note[id] ?? ""}
        onChange={(e) => setNote((n) => ({ ...n, [id]: e.target.value }))}
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => onDecide(id, true)}>
          Approve
        </Button>
        <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => onDecide(id, false)}>
          Deny
        </Button>
      </div>
    </div>
  );
}

// ── Template + settings ─────────────────────────────────────
interface Block {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  title: string | null;
  role_needs: Record<string, number>;
  is_active: boolean;
}
interface Settings {
  window_start: string;
  window_end: string;
  default_block_minutes: number;
}

function TemplateManager() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        fetch("/api/prayer-room/template").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/prayer-room/settings").then((r) => (r.ok ? r.json() : null)),
      ]);
      setBlocks(b);
      setSettings(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addBlock(form: FormData) {
    setBusy(true);
    try {
      const role_needs: Record<string, number> = {};
      ROLES.forEach((r) => {
        const n = Number(form.get(`need_${r}`) || 0);
        if (n > 0) role_needs[r] = n;
      });
      const res = await fetch("/api/prayer-room/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: Number(form.get("day_of_week")),
          start_time: form.get("start_time"),
          end_time: form.get("end_time"),
          title: form.get("title") || null,
          role_needs,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Block added");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock(id: string) {
    const res = await fetch(`/api/prayer-room/template?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Block removed");
      load();
    } else {
      toast.error("Failed to remove");
    }
  }

  async function saveSettings(form: FormData) {
    const res = await fetch("/api/prayer-room/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        window_start: form.get("window_start"),
        window_end: form.get("window_end"),
        default_block_minutes: Number(form.get("default_block_minutes")),
      }),
    });
    if (res.ok) toast.success("Settings saved");
    else toast.error("Failed to save settings");
  }

  if (loading) return <p className="py-12 text-center text-muted-foreground">Loading…</p>;

  const byDay: Record<number, Block[]> = {};
  blocks.forEach((b) => (byDay[b.day_of_week] ??= []).push(b));

  return (
    <div className="space-y-6">
      {settings && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operating window</h3>
          <form action={saveSettings} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Opens</Label>
              <Input type="time" name="window_start" defaultValue={settings.window_start?.slice(0, 5)} className="w-32" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closes</Label>
              <Input type="time" name="window_end" defaultValue={settings.window_end?.slice(0, 5)} className="w-32" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Block length (min)</Label>
              <Input type="number" name="default_block_minutes" defaultValue={settings.default_block_minutes} className="w-28" />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Save
            </Button>
          </form>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Weekly blocks</h3>
        {blocks.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">No template blocks yet. Add the standing grid below, then use “Generate week” on the Schedule.</p>
        ) : (
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DAYS_SHORT.map((dayName, dow) =>
              (byDay[dow] ?? []).map((b) => (
                <div key={b.id} className="flex items-start justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">
                      {dayName} · {formatTimeRange(b.start_time, b.end_time)}
                    </div>
                    {b.title && <div className="text-xs text-muted-foreground">{b.title}</div>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(b.role_needs || {}).map(([r, n]) => (
                        <Badge key={r} variant="outline" className="text-[10px]">
                          {n}× {roleLabel(r)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => removeBlock(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <form action={addBlock} className="rounded-lg border border-dashed border-border p-4">
          <p className="mb-3 text-sm font-medium">Add a block</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Day</Label>
              <select name="day_of_week" defaultValue="1" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {DAYS_SHORT.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input type="time" name="start_time" defaultValue="06:00" className="w-28" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Input type="time" name="end_time" defaultValue="08:00" className="w-28" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input name="title" placeholder="optional" className="w-36" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {ROLES.map((r) => (
              <div key={r} className="space-y-1">
                <Label className="text-xs">{roleLabel(r)}</Label>
                <Input type="number" name={`need_${r}`} defaultValue={0} min={0} className="w-20" />
              </div>
            ))}
            <Button type="submit" size="sm" className="gap-1" disabled={busy}>
              <Plus className="h-4 w-4" /> Add block
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Members admin ───────────────────────────────────────────
interface Member {
  user_id: string;
  status: string;
  is_coordinator: boolean;
  user: Person;
}

function MembersManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prayer-room/members");
      setMembers(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function update(userId: string, action: string, value: unknown) {
    setBusy(userId + action);
    try {
      const res = await fetch("/api/prayer-room/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action, value }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="py-12 text-center text-muted-foreground">Loading…</p>;
  if (members.length === 0) return <p className="py-12 text-center text-muted-foreground">No approved members yet.</p>;

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <span className="font-medium">{fullName(m.user)}</span>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip label="Coordinator" on={m.is_coordinator} busy={busy === m.user_id + "coordinator"} onClick={() => update(m.user_id, "coordinator", !m.is_coordinator)} />
            <Select value={m.status} onValueChange={(v) => update(m.user_id, "status", v)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MEMBER_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

function ToggleChip({ label, on, busy, onClick }: { label: string; on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <Badge
      variant={on ? "default" : "outline"}
      className={`cursor-pointer select-none ${busy ? "opacity-50" : ""}`}
      onClick={busy ? undefined : onClick}
    >
      {label}
    </Badge>
  );
}
