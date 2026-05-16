"use client";

import { useState, useRef, useCallback } from "react";
import { useController, type Control } from "react-hook-form";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion, FileValue } from "@/lib/form-types";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB raw — we'll compress before upload
const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2MB — compress anything bigger than this
const MAX_DIMENSION = 1600; // resize so the longest side is 1600px max
const COMPRESS_QUALITY = 0.85;

// Detect image type from filename extension when file.type is missing/weird
function detectImageType(file: File): string | null {
  if (file.type && file.type.startsWith("image/")) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return null;
}

// Strip everything except letters/numbers/dot/dash so storage paths stay clean
function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot >= 0 ? name.substring(0, lastDot) : name;
  const ext = lastDot >= 0 ? name.substring(lastDot) : "";
  const cleanBase = base.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 50);
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${cleanBase}${cleanExt || ".jpg"}`;
}

// Compress image client-side using canvas. Falls back to original on failure.
async function compressImage(file: File): Promise<File> {
  // Skip compression for HEIC — canvas can't render it in most browsers
  const type = detectImageType(file) || file.type;
  if (type === "image/heic" || type === "image/heif") return file;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image load failed"));
      i.src = dataUrl;
    });

    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", COMPRESS_QUALITY);
    });

    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function FileUpload({
  question,
  control,
  applicationId,
}: {
  question: FormQuestion;
  control: Control<any>;
  applicationId?: string;
}) {
  const { field, fieldState } = useController({
    name: question.id,
    control,
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (rawFile: File) => {
      setUploadError(null);

      const detectedType = detectImageType(rawFile);
      if (!detectedType) {
        setUploadError(
          "Please choose an image file (JPG, PNG, HEIC, or WebP)"
        );
        return;
      }

      if (rawFile.size > MAX_SIZE) {
        setUploadError(
          `Photo is ${(rawFile.size / 1024 / 1024).toFixed(1)}MB — please choose one under 25MB`
        );
        return;
      }

      setPreview(URL.createObjectURL(rawFile));
      setUploading(true);

      try {
        // Compress large images (skip HEIC since canvas can't decode it)
        let file = rawFile;
        if (rawFile.size > COMPRESS_THRESHOLD) {
          file = await compressImage(rawFile);
        }

        const contentType = detectImageType(file) || "image/jpeg";
        const cleanName = sanitizeFilename(file.name);
        const uuid = crypto.randomUUID();
        const appId = applicationId || "draft";
        const path = `applications/${appId}/${question.id}/${uuid}-${cleanName}`;

        const signRes = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: "application-uploads",
            path,
            contentType,
          }),
        });

        if (!signRes.ok) {
          let serverMsg = "Failed to get upload URL";
          try {
            const errData = await signRes.json();
            if (errData.error) serverMsg = errData.error;
          } catch {
            /* ignore */
          }
          throw new Error(serverMsg);
        }

        const { signedUrl } = await signRes.json();

        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          let uploadMsg = `Upload failed (${uploadRes.status})`;
          try {
            const errText = await uploadRes.text();
            if (errText) uploadMsg = `Upload failed: ${errText.slice(0, 100)}`;
          } catch {
            /* ignore */
          }
          throw new Error(uploadMsg);
        }

        const value: FileValue = {
          storagePath: path,
          mimeType: contentType,
          size: file.size,
          originalName: rawFile.name,
        };

        field.onChange(value);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Upload failed. Please try again.";
        setUploadError(msg);
        setPreview(null);
        field.onChange(null);
        // Help us debug mobile failures
        console.error("Photo upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [applicationId, question.id, field]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setPreview(null);
    setUploadError(null);
    field.onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasValue =
    field.value && typeof field.value === "object" && field.value.storagePath;

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message || uploadError || undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        id={question.id}
      />

      {hasValue && preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Upload preview"
            className="h-32 w-32 rounded-lg object-cover border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-muted-foreground/50 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading photo…</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Tap to choose a photo
              </p>
              <p className="text-xs text-muted-foreground text-center">
                JPG, PNG, or HEIC — up to 25MB
              </p>
            </>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}
