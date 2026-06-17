"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone } from "lucide-react";
import { fullName, MEMBER_STATUS_LABELS, type Person } from "./helpers";

interface Member {
  user_id: string;
  status: string;
  is_evaluator: boolean;
  is_coordinator: boolean;
  user: Person;
  skills: { id: string; name: string; category: string }[];
}
interface UserLabel {
  id: string;
  name: string;
}
interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
}

export default function Directory() {
  const [members, setMembers] = useState<Member[]>([]);
  const [labels, setLabels] = useState<UserLabel[]>([]);
  const [search, setSearch] = useState("");
  const [labelId, setLabelId] = useState("all");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/user-labels?category=ministry_role").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/user-labels?category=instrument").then((r) => (r.ok ? r.json() : [])),
    ]).then(([a, b]) => setLabels([...(a || []), ...(b || [])]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (labelId !== "all") params.set("labelId", labelId);
      const res = await fetch(`/api/prayer-room/members?${params}`);
      setMembers(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [status, labelId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openContact(userId: string) {
    setContactLoading(true);
    try {
      const res = await fetch(`/api/prayer-room/members?contactFor=${userId}`);
      if (res.ok) setContact(await res.json());
    } finally {
      setContactLoading(false);
    }
  }

  const filtered = members.filter((m) => !search || fullName(m.user).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={labelId} onValueChange={setLabelId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All skills" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All skills</SelectItem>
            {labels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_break">On a break</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No members found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((m) => (
            <div key={m.user_id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{fullName(m.user)}</span>
                    {m.is_coordinator && <Badge variant="outline" className="text-[10px]">Coordinator</Badge>}
                    {m.is_evaluator && <Badge variant="outline" className="text-[10px]">Evaluator</Badge>}
                  </div>
                  {m.status !== "active" && (
                    <span className="text-xs text-muted-foreground">{MEMBER_STATUS_LABELS[m.status]}</span>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-7 shrink-0" disabled={contactLoading} onClick={() => openContact(m.user_id)}>
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.skills.length === 0 ? (
                  <span className="text-xs text-muted-foreground/60">No skills tagged</span>
                ) : (
                  m.skills.map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-[10px]">
                      {s.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!contact} onOpenChange={(o) => !o && setContact(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{contact ? fullName(contact) : "Contact"}</DialogTitle>
          </DialogHeader>
          {contact && (
            <div className="space-y-2 text-sm">
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Mail className="h-4 w-4" /> {contact.email}
                </a>
              ) : (
                <p className="text-muted-foreground">No email on file</p>
              )}
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-4 w-4" /> {contact.phone}
                </a>
              ) : (
                <p className="text-muted-foreground">No phone on file</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
