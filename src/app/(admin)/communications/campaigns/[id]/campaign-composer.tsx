"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={sent}
          className="text-xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 outline-none flex-1"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
            {campaign.status}
          </span>
          {!sent && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Save draft
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {sent && (
        <p className="text-sm text-amber-600">
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
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sent}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="What recipients see in their inbox"
                />
              </Field>
              <Field label="Preview text">
                <input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  disabled={sent}
                  className="w-full border rounded px-2 py-1.5 text-sm"
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
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => addBlock(t.type)}
                      className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    >
                      + {t.label}
                    </button>
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
  const inputCls = "w-full border rounded px-2 py-1 text-sm";
  return (
    <div className="border rounded p-2.5 bg-gray-50/50 space-y-1.5">
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
        <input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={disabled}
          className={inputCls}
        />
      )}
      {block.type === "text" && (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={disabled}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      )}
      {block.type === "button" && (
        <>
          <input
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            disabled={disabled}
            placeholder="Button label"
            className={inputCls}
          />
          <input
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            disabled={disabled}
            placeholder="https://…"
            className={inputCls}
          />
        </>
      )}
      {block.type === "image" && (
        <>
          <input
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            disabled={disabled}
            placeholder="Image URL (https://…)"
            className={inputCls}
          />
          <input
            value={block.alt}
            onChange={(e) => onChange({ alt: e.target.value })}
            disabled={disabled}
            placeholder="Alt text"
            className={inputCls}
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
        danger ? "text-red-600 hover:bg-red-50" : "hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
