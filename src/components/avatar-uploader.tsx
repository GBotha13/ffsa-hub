"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { compressImageToMaxBytes } from "@/lib/image";

/**
 * Avatar + click-to-upload affordance. Used on the self-profile page
 * and the admin user-detail header. Re-renders the new image inline
 * (no full reload needed) but also calls router.refresh() so any
 * other server-rendered avatar on the page (sidebar, breadcrumb)
 * picks up the new URL on the next paint.
 */
export function AvatarUploader({
  userId,
  initialSrc,
  name,
  size = 72,
  canEdit = true,
}: {
  userId: string;
  initialSrc?: string | null;
  name?: string | null;
  size?: number;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(initialSrc ?? null);
  const [uploading, setUploading] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Resize + re-encode in the browser so we store a small JPEG and never
      // trip the 1 MB avatars-bucket limit. Falls back to the original file
      // if anything goes wrong (the server still validates size/type).
      setBusyLabel("Optimizing…");
      const prepared = await compressImageToMaxBytes(file);
      setBusyLabel("Uploading…");
      const fd = new FormData();
      fd.append("file", prepared);
      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setSrc(data.avatarUrl as string);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
      setBusyLabel(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Remove failed");
        return;
      }
      setSrc(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  }

  if (!canEdit) {
    return <UserAvatar src={src} name={name} size={size} />;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60"
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={src ? "Change photo" : "Upload photo"}
        title={src ? "Change photo" : "Upload photo"}
      >
        <UserAvatar src={src} name={name} size={size} />
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: "rgba(0,0,0,0.55)",
            color: "white",
            fontSize: Math.max(9, Math.round(size * 0.13)),
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {uploading ? "…" : "Change"}
        </span>
      </button>
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2"
          style={{ letterSpacing: "0.08em" }}
        >
          {uploading ? (busyLabel ?? "Uploading…") : src ? "Change photo" : "Upload photo"}
        </button>
        {src && !uploading && (
          <>
            <span className="opacity-40">·</span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-muted-foreground hover:text-destructive underline underline-offset-2"
            >
              Remove
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
