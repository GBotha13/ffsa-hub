"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { APPLICATION_STATUS_LABELS } from "./helpers";

interface UserLabel {
  id: string;
  name: string;
  category: string;
}
interface MyApplication {
  id: string;
  status: string;
  background: string | null;
  skills: { label: { id: string; name: string } | null }[];
}

const ACTIVE_STATES = ["applied", "assigned", "evaluated"];

export default function ApplyForm() {
  const [labels, setLabels] = useState<UserLabel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [background, setBackground] = useState("");
  const [app, setApp] = useState<MyApplication | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/user-labels?category=ministry_role").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/user-labels?category=instrument").then((r) => (r.ok ? r.json() : [])),
    ]).then(([roles, instruments]) => setLabels([...(roles || []), ...(instruments || [])]));

    fetch("/api/prayer-room/applications/my-status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setApp)
      .catch(() => setApp(null));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      toast.error("Pick at least one way you'd like to serve");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/prayer-room/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelIds: [...selected], background: background.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply");
      toast.success("Application submitted!");
      setApp({ id: data.id, status: "applied", background, skills: [...selected].map((id) => ({ label: labels.find((l) => l.id === id) ?? null })) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  }

  // pending/in-flight application → show status, not the form
  if (app && ACTIVE_STATES.includes(app.status)) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-6 text-center">
        <p className="page-eyebrow">APPLICATION STATUS</p>
        <h2 className="mb-2 text-xl font-semibold">{APPLICATION_STATUS_LABELS[app.status] ?? app.status}</h2>
        <p className="text-sm text-muted-foreground">
          {app.status === "applied" && "Thanks for applying! A coordinator will assign you to an evaluator soon."}
          {app.status === "assigned" && "You've been assigned to an evaluator — they'll reach out to meet with you."}
          {app.status === "evaluated" && "Your evaluation is recorded. You'll hear the outcome shortly."}
        </p>
        {app.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {app.skills.map((s, i) => s.label && <Badge key={i} variant="outline">{s.label.name}</Badge>)}
          </div>
        )}
      </div>
    );
  }

  const wasDenied = app && app.status === "denied";
  const ministry = labels.filter((l) => l.category === "ministry_role");
  const instruments = labels.filter((l) => l.category === "instrument");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Join the prayer room team</h2>
        <p className="text-sm text-muted-foreground">
          {wasDenied
            ? "You can submit a fresh application below."
            : "Tell us how you'd like to serve. A coordinator will pair you with an evaluator to meet."}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">How would you like to serve?</Label>
        <SkillGroup title="Roles" labels={ministry} selected={selected} onToggle={toggle} />
        <SkillGroup title="Instruments / vocals" labels={instruments} selected={selected} onToggle={toggle} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">A bit about you (optional)</Label>
        <Textarea
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={4}
          placeholder="Your worship/prayer background, experience, what you sense God calling you into…"
        />
      </div>

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit application"}
      </Button>
    </div>
  );
}

function SkillGroup({
  title,
  labels,
  selected,
  onToggle,
}: {
  title: string;
  labels: UserLabel[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (labels.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => (
          <Badge
            key={l.id}
            variant={selected.has(l.id) ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => onToggle(l.id)}
          >
            {l.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
