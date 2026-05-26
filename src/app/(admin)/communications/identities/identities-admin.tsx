"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Palette, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isLikelyVerifiedDomain,
  type SendingIdentity,
} from "@/services/sending-identities";

type EditState = {
  id: string;
  display_name: string;
  from_email: string;
  from_name: string;
  reply_to: string;
};

type NewState = {
  display_name: string;
  from_email: string;
  from_name: string;
  reply_to: string;
};

const EMPTY_NEW: NewState = {
  display_name: "",
  from_email: "",
  from_name: "",
  reply_to: "hello@ffsahub.com",
};

export function IdentitiesAdmin({
  initialIdentities,
}: {
  initialIdentities: SendingIdentity[];
}) {
  const router = useRouter();
  const [identities, setIdentities] =
    useState<SendingIdentity[]>(initialIdentities);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState<NewState>(EMPTY_NEW);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const activeCount = identities.filter((i) => i.is_active).length;

  function startEdit(i: SendingIdentity) {
    setEditing({
      id: i.id,
      display_name: i.display_name,
      from_email: i.from_email,
      from_name: i.from_name,
      reply_to: i.reply_to ?? "",
    });
    setErr(null);
    setMsg(null);
  }

  function cancelEdit() {
    setEditing(null);
    setErr(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/sending-identities/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: editing.display_name,
        from_email: editing.from_email,
        from_name: editing.from_name,
        reply_to: editing.reply_to,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Save failed");
      return;
    }
    const data = (await res.json()) as { identity: SendingIdentity };
    setIdentities((list) =>
      list.map((row) => (row.id === data.identity.id ? data.identity : row))
    );
    setEditing(null);
    setMsg("Identity updated.");
    router.refresh();
  }

  async function toggleActive(i: SendingIdentity) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/sending-identities/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !i.is_active }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Update failed");
      return;
    }
    const data = (await res.json()) as { identity: SendingIdentity };
    setIdentities((list) =>
      list.map((row) => (row.id === data.identity.id ? data.identity : row))
    );
    setMsg(
      data.identity.is_active
        ? `${data.identity.display_name} reactivated.`
        : `${data.identity.display_name} deactivated — it'll no longer appear in the composer dropdown.`
    );
    router.refresh();
  }

  async function createNew() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/sending-identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRow),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Create failed");
      return;
    }
    const data = (await res.json()) as { identity: SendingIdentity };
    setIdentities((list) =>
      [...list, data.identity].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.display_name.localeCompare(b.display_name);
      })
    );
    setCreating(false);
    setNewRow(EMPTY_NEW);
    setMsg(`${data.identity.display_name} added.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-400">{err}</p>}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {activeCount} active {activeCount === 1 ? "identity" : "identities"}
          {identities.length > activeCount &&
            ` · ${identities.length - activeCount} deactivated`}
        </p>
        {!creating && (
          <Button onClick={() => setCreating(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add identity
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Display name (shown in this app)">
                <Input
                  value={newRow.display_name}
                  onChange={(e) =>
                    setNewRow({ ...newRow, display_name: e.target.value })
                  }
                  placeholder="e.g. FFSA Conferences"
                />
              </Field>
              <Field label="From name (shown to recipients)">
                <Input
                  value={newRow.from_name}
                  onChange={(e) =>
                    setNewRow({ ...newRow, from_name: e.target.value })
                  }
                  placeholder="e.g. FFSA Conferences"
                />
              </Field>
              <Field label="From email">
                <Input
                  type="email"
                  value={newRow.from_email}
                  onChange={(e) =>
                    setNewRow({ ...newRow, from_email: e.target.value })
                  }
                  placeholder="e.g. conferences@ffsahub.com"
                />
                <DomainWarning email={newRow.from_email} />
              </Field>
              <Field label="Reply-to (where replies go)">
                <Input
                  type="email"
                  value={newRow.reply_to}
                  onChange={(e) =>
                    setNewRow({ ...newRow, reply_to: e.target.value })
                  }
                  placeholder="hello@ffsahub.com"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setNewRow(EMPTY_NEW);
                  setErr(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={createNew} disabled={busy} size="sm">
                {busy ? "Creating…" : "Create identity"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>From email</TableHead>
                <TableHead>Reply-to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {identities.map((i) => {
                const isEditing = editing?.id === i.id;
                return (
                  <TableRow
                    key={i.id}
                    className={i.is_active ? "" : "opacity-50"}
                  >
                    {isEditing ? (
                      <>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Input
                              value={editing.display_name}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  display_name: e.target.value,
                                })
                              }
                              className="text-sm"
                              placeholder="Display name"
                            />
                            <Input
                              value={editing.from_name}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  from_name: e.target.value,
                                })
                              }
                              className="text-xs"
                              placeholder="From name"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={editing.from_email}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                from_email: e.target.value,
                              })
                            }
                            className="text-xs"
                          />
                          <DomainWarning email={editing.from_email} />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={editing.reply_to}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                reply_to: e.target.value,
                              })
                            }
                            className="text-xs"
                            placeholder="(none)"
                          />
                        </TableCell>
                        <TableCell>
                          <StatusPill active={i.is_active} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={busy}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={busy}
                            className="h-7 px-2 text-xs"
                          >
                            {busy ? "…" : "Save"}
                          </Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {i.display_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {i.from_name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {i.from_email}
                          <DomainWarning email={i.from_email} />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {i.reply_to || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusPill active={i.is_active} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Link
                            href={`/communications/brand?identity=${i.id}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
                            title="Open brand kit"
                          >
                            <Palette className="h-3.5 w-3.5" />
                            Brand
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(i)}
                            disabled={busy}
                            className="h-7 px-2 text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(i)}
                            disabled={busy}
                            className={`h-7 px-2 text-xs ${
                              i.is_active ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {i.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: each identity has its own brand kit. Click <strong>Brand</strong>{" "}
        on a row to set logo, colors, fonts, and footer for that identity.
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-muted-foreground mb-1 text-xs">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        active ? "status-green" : "status-grey"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function DomainWarning({ email }: { email: string }) {
  if (!email || !email.includes("@")) return null;
  if (isLikelyVerifiedDomain(email)) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-amber-400 mt-1">
      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      Domain not auto-verified — confirm DNS in Mailtrap before sending.
    </p>
  );
}
