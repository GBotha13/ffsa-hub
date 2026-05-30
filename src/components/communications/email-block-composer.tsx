"use client";

// ============================================================
// EmailBlockComposer — shared block-based email editor.
// ============================================================
// Emits the same CampaignBody format campaigns use, so workflow
// step emails render through the identical pipeline
// (renderCampaignHtml + brand). Reuses the shared RichText editor.
// A focused subset of the campaign block vocabulary; the campaign
// composer can be migrated onto this component as a later cleanup.
// ============================================================

import { RichText } from "@/components/communications/rich-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  type CampaignBody,
  type CampaignBlock,
  newBlockId,
} from "@/lib/campaigns/blocks";

type Props = {
  value: CampaignBody | null | undefined;
  onChange: (body: CampaignBody) => void;
  disabled?: boolean;
};

const ADDABLE: { type: CampaignBlock["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "image", label: "Image" },
  { type: "quote", label: "Quote" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
];

function makeBlock(type: CampaignBlock["type"]): CampaignBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type: "heading", text: "" };
    case "button":
      return { id, type: "button", text: "", url: "", style: "filled" };
    case "image":
      return { id, type: "image", url: "", alt: "" };
    case "quote":
      return { id, type: "quote", text: "" };
    case "divider":
      return { id, type: "divider", style: "rule" };
    case "spacer":
      return { id, type: "spacer", size: "md" };
    case "eyebrow":
      return { id, type: "eyebrow", text: "" };
    case "text":
    default:
      return { id, type: "text", text: "" };
  }
}

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm w-full";

export function EmailBlockComposer({ value, onChange, disabled }: Props) {
  const blocks = value?.blocks ?? [];

  const setBlocks = (next: CampaignBlock[]) =>
    onChange({ version: 1, blocks: next });
  const add = (type: CampaignBlock["type"]) => setBlocks([...blocks, makeBlock(type)]);
  const patch = (id: string, p: Partial<CampaignBlock>) =>
    setBlocks(
      blocks.map((b) => (b.id === id ? ({ ...b, ...p } as CampaignBlock) : b))
    );
  const remove = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No content yet — add a block below.
          </p>
        )}
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className="rounded-lg border bg-muted/40 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                {block.type}
              </span>
              <div className="flex gap-1">
                <IconBtn
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                  label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === blocks.length - 1}
                  label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => remove(block.id)}
                  disabled={disabled}
                  label="Remove"
                  danger
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
            <BlockFields
              block={block}
              disabled={disabled}
              onPatch={(p) => patch(block.id, p)}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ADDABLE.map((a) => (
          <Button
            key={a.type}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => add(a.type)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function BlockFields({
  block,
  disabled,
  onPatch,
}: {
  block: CampaignBlock;
  disabled?: boolean;
  onPatch: (p: Partial<CampaignBlock>) => void;
}) {
  if (block.type === "heading") {
    return (
      <>
        <Input
          value={block.eyebrow ?? ""}
          onChange={(e) => onPatch({ eyebrow: e.target.value || undefined })}
          disabled={disabled}
          placeholder="Eyebrow (optional)"
          className="text-xs"
        />
        <Input
          value={block.text}
          onChange={(e) => onPatch({ text: e.target.value })}
          disabled={disabled}
          placeholder="Headline"
          className="text-sm font-medium"
        />
      </>
    );
  }
  if (block.type === "eyebrow") {
    return (
      <Input
        value={block.text}
        onChange={(e) => onPatch({ text: e.target.value })}
        disabled={disabled}
        placeholder="Small uppercase label"
        className="text-xs"
      />
    );
  }
  if (block.type === "text") {
    return (
      <RichText
        value={block.text}
        onChange={(html) => onPatch({ text: html })}
        disabled={disabled}
        placeholder="Write your message — bold, italics, and links supported."
      />
    );
  }
  if (block.type === "button") {
    return (
      <>
        <Input
          value={block.text}
          onChange={(e) => onPatch({ text: e.target.value })}
          disabled={disabled}
          placeholder="Button label"
        />
        <Input
          value={block.url}
          onChange={(e) => onPatch({ url: e.target.value })}
          disabled={disabled}
          placeholder="https://…"
        />
        <select
          className={selectClass}
          value={block.style ?? "filled"}
          disabled={disabled}
          onChange={(e) =>
            onPatch({ style: e.target.value as "filled" | "outline" | "link" })
          }
        >
          <option value="filled">Filled</option>
          <option value="outline">Outline</option>
          <option value="link">Text link</option>
        </select>
      </>
    );
  }
  if (block.type === "image") {
    return (
      <>
        <Input
          value={block.url}
          onChange={(e) => onPatch({ url: e.target.value })}
          disabled={disabled}
          placeholder="Image URL (https://…)"
        />
        <Input
          value={block.alt}
          onChange={(e) => onPatch({ alt: e.target.value })}
          disabled={disabled}
          placeholder="Alt text (for accessibility)"
          className="text-xs"
        />
        <Input
          value={block.caption ?? ""}
          onChange={(e) => onPatch({ caption: e.target.value || undefined })}
          disabled={disabled}
          placeholder="Caption (optional)"
          className="text-xs"
        />
      </>
    );
  }
  if (block.type === "quote") {
    return (
      <>
        <Input
          value={block.text}
          onChange={(e) => onPatch({ text: e.target.value })}
          disabled={disabled}
          placeholder="Quote text"
        />
        <Input
          value={block.attribution ?? ""}
          onChange={(e) => onPatch({ attribution: e.target.value || undefined })}
          disabled={disabled}
          placeholder="Attribution (optional)"
          className="text-xs"
        />
      </>
    );
  }
  if (block.type === "divider") {
    return (
      <select
        className={selectClass}
        value={block.style ?? "rule"}
        disabled={disabled}
        onChange={(e) =>
          onPatch({ style: e.target.value as "rule" | "dots" | "space" })
        }
      >
        <option value="rule">Rule</option>
        <option value="dots">Dots</option>
        <option value="space">Space</option>
      </select>
    );
  }
  if (block.type === "spacer") {
    return (
      <select
        className={selectClass}
        value={block.size ?? "md"}
        disabled={disabled}
        onChange={(e) =>
          onPatch({ size: e.target.value as "sm" | "md" | "lg" | "xl" })
        }
      >
        <option value="sm">Small</option>
        <option value="md">Medium</option>
        <option value="lg">Large</option>
        <option value="xl">Extra large</option>
      </select>
    );
  }
  return null;
}

function IconBtn({
  onClick,
  disabled,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? "hover:text-red-600 hover:border-red-300" : ""
      }`}
    >
      {children}
    </button>
  );
}
