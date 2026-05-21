"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type CampaignBlock,
  type CampaignBlockType,
  type CampaignBody,
  newBlockId,
  renderCampaignHtml,
} from "@/lib/campaigns/blocks";

type Label = { id: string; slug: string; name: string };
type Identity = { id: string; display_name: string; from_email: string };

type CampaignMeta = {
  id: string;
  name: string;
  subject: string;
  preview_text: string;
  label_id: string | null;
  sending_identity_id: string | null;
  status: string;
  scheduled_at: string | null;
};

const ADD_TYPES: { type: CampaignBlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "image", label: "Image" },
  { type: "divider", label: "Divider" },
];

const STATUS_CLASS: Record<string, string> = {
  draft: "status-grey",
  scheduled: "status-yellow",
  sending: "status-yellow",
  sent: "status-green",
  failed: "status-red",
  cancelled: "status-grey",
};

export function CampaignComposer({
  campaign,
  initialBody,
  labels,
  identities,
  audienceCount,
}: {
  campaign: CampaignMeta;
  initialBody: CampaignBody;
  labels: Label[];
  identities: Identity[];
  audienceCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [previewText, setPreviewText] = useState(campaign.preview_text);
  const [labelId, setLabelId] = useState(campaign.label_id ?? "");
  const [identityId, setIdentityId] = useState(campaign.sending_identity_id ?? "");
  const [body, setBody] = useState<CampaignBody>(initialBody);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "done">("idle");
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0 });

  const sent = campaign.status === "sent" || campaign.status === "sending";

  const previewHtml = useMemo(
    () => renderCampaignHtml(body, { previewText }),
    [body, previewText]
  );

  function newBlock(type: CampaignBlockType): CampaignBlock {
    switch (type) {
      case "heading":
        return { id: newBlockId(), type, text: "Heading" };
      case "text":
        return { id: newBlockId(), type, text: "Write your message…" };
      case "button":
        return { id: newBlockId(), type, text: "Learn more", url: "https://" };
      case "image":
        return { id: newBlockId(), type, url: "https://", alt: "" };
      case "divider":
        return { id: newBlockId(), type };
    }
  }
  function addBlock(type: CampaignBlockType) {
    setBody((b) => ({ ...b, blocks: [...b.blocks, newBlock(type)] }));
  }
  function updateBlock(id: string, patch: Partial<CampaignBlock>) {
    setBody((b) => ({
      ...b,
      blocks: b.blocks.map((bl) =>
        bl.id === id ? ({ ...bl, ...patch } as CampaignBlock) : bl
      ),
    }));
  }
  function removeBlock(id: string) {
    setBody((b) => ({ ...b, blocks: b.blocks.filter((bl) => bl.id !== id) }));
  }
  function moveBlock(idx: number, dir: -1 | 1) {
    setBody((b) => {
      const next = [...b.blocks];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return b;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...b, blocks: next };
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        subject,
        preview_text: previewText,
        body_source: body,
        label_id: labelId || undefined,
        sending_identity_id: identityId || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Failed to save");
      return;
    }
    setMsg("Saved");
    router.refresh();
  }

  /** Persist the latest content, then return whether it succeeded. */
  async function persist(): Promise<boolean> {
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        subject,
        preview_text: previewText,
        body_source: body,
        label_id: labelId || undefined,
        sending_identity_id: identityId || undefined,
      }),
    });
    return res.ok;
  }

  function preflightError(): string | null {
    if (!subject.trim()) return "Add a subject line before sending.";
    if (!labelId) return "Pick an audience label.";
    if (!identityId) return "Pick a sending identity.";
    if (body.blocks.length === 0) return "Add at least one content block.";
    return null;
  }

  async function sendNow() {
    const pf = preflightError();
    if (pf) return setErr(pf);
    if (
      !confirm(
        `Send "${name}" to ${audienceCount} contact${
          audienceCount === 1 ? "" : "s"
        } now?`
      )
    )
      return;

    setErr(null);
    setMsg(null);
    if (!(await persist())) return setErr("Could not save the campaign.");

    setSendState("sending");
    let totalSent = 0;
    let totalFailed = 0;
    // Loop the batch endpoint until the audience is drained.
    for (let i = 0; i < 1000; i++) {
      const res = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(data.error ?? "Send failed");
        setSendState("idle");
        return;
      }
      const r = (await res.json()) as {
        sent: number;
        failed: number;
        done: boolean;
      };
      totalSent += r.sent;
      totalFailed += r.failed;
      setSendProgress({ sent: totalSent, failed: totalFailed });
      if (r.done) break;
    }
    setSendState("done");
    router.refresh();
  }

  async function schedule() {
    const pf = preflightError();
    if (pf) return setErr(pf);
    if (!scheduleAt) return setErr("Pick a date and time.");
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return setErr("Pick a future date and time.");
    }
    setErr(null);
    setBusy(true);
    if (!(await persist())) {
      setBusy(false);
      return setErr("Could not save the campaign.");
    }
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "scheduled",
        scheduled_at: when.toISOString(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return setErr(data.error ?? "Could not schedule");
    }
    setMsg(`Scheduled for ${when.toLocaleString()}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={sent}
          className="flex-1 text-base font-semibold"
        />
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              STATUS_CLASS[campaign.status] ?? "status-grey"
            }`}
          >
            {campaign.status}
          </span>
          {!sent && (
            <Button
              variant="outline"
              size="sm"
              onClick={save}
              disabled={busy}
            >
              Save draft
            </Button>
          )}
        </div>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {sent && (
        <p className="text-sm text-amber-400">
          This campaign has been sent and can no longer be edited.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Subject line">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sent}
                  placeholder="What recipients see in their inbox"
                />
              </Field>
              <Field label="Preview text">
                <Input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  disabled={sent}
                  placeholder="The grey text shown after the subject"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Audience (label)">
                  <select
                    value={labelId}
                    onChange={(e) => setLabelId(e.target.value)}
                    disabled={sent}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">— pick —</option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Send from">
                  <select
                    value={identityId}
                    onChange={(e) => setIdentityId(e.target.value)}
                    disabled={sent}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">— pick —</option>
                    {identities.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Current audience:{" "}
                <span className="font-medium">{audienceCount}</span> contact
                {audienceCount === 1 ? "" : "s"} (subscribed, not unsubscribed or
                bounced).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content blocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {body.blocks.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No blocks — add one below.
                </p>
              )}
              {body.blocks.map((block, idx) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  disabled={sent}
                  onChange={(patch) => updateBlock(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                  onUp={() => moveBlock(idx, -1)}
                  onDown={() => moveBlock(idx, 1)}
                  canUp={idx > 0}
                  canDown={idx < body.blocks.length - 1}
                />
              ))}
              {!sent && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ADD_TYPES.map((t) => (
                    <Button
                      key={t.type}
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock(t.type)}
                      className="gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <Card className="lg:sticky lg:top-4 self-start">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="w-full rounded border"
              style={{ height: 520, background: "#fff" }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Send */}
      {!sent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sendState === "sending" && (
              <p className="text-sm text-sky-400">
                Sending… {sendProgress.sent} sent
                {sendProgress.failed > 0 ? `, ${sendProgress.failed} failed` : ""}
              </p>
            )}
            {sendState === "done" && (
              <p className="text-sm text-emerald-400">
                ✓ Campaign sent — {sendProgress.sent} delivered to the provider
                {sendProgress.failed > 0 ? `, ${sendProgress.failed} failed` : ""}.
              </p>
            )}
            {sendState === "idle" && (
              <div className="flex flex-wrap items-end gap-4">
                <Button onClick={sendNow} disabled={busy}>
                  Send now to {audienceCount}
                </Button>
                <span className="text-sm text-muted-foreground">or</span>
                <div className="flex items-end gap-2">
                  <label className="block">
                    <span className="block text-muted-foreground mb-1 text-xs">
                      Schedule for
                    </span>
                    <Input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="w-auto"
                    />
                  </label>
                  <Button variant="outline" onClick={schedule} disabled={busy}>
                    Schedule
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Recipients are deduplicated and exclude anyone unsubscribed,
              bounced, or not subscribed. Every email includes an unsubscribe
              link.
            </p>
          </CardContent>
        </Card>
      )}
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

function BlockEditor({
  block,
  disabled,
  onChange,
  onRemove,
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  block: CampaignBlock;
  disabled: boolean;
  onChange: (patch: Partial<CampaignBlock>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {block.type}
        </span>
        <div className="flex gap-1">
          <Mini onClick={onUp} disabled={disabled || !canUp} label="↑" />
          <Mini onClick={onDown} disabled={disabled || !canDown} label="↓" />
          <Mini onClick={onRemove} disabled={disabled} label="✕" danger />
        </div>
      </div>
      {block.type === "heading" && (
        <Input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={disabled}
        />
      )}
      {block.type === "text" && (
        <Textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={disabled}
          rows={3}
          className="resize-none"
        />
      )}
      {block.type === "button" && (
        <>
          <Input
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            disabled={disabled}
            placeholder="Button label"
          />
          <Input
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            disabled={disabled}
            placeholder="https://…"
          />
        </>
      )}
      {block.type === "image" && (
        <>
          <Input
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            disabled={disabled}
            placeholder="Image URL (https://…)"
          />
          <Input
            value={block.alt}
            onChange={(e) => onChange({ alt: e.target.value })}
            disabled={disabled}
            placeholder="Alt text"
          />
        </>
      )}
      {block.type === "divider" && (
        <p className="text-xs text-muted-foreground">A horizontal divider line.</p>
      )}
    </div>
  );
}

function Mini({
  onClick,
  disabled,
  label,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-5 h-5 text-[11px] rounded border disabled:opacity-30 ${
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
