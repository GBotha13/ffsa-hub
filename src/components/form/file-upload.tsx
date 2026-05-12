"use client";

import { useState, useRef, useCallback } from "react";
import { useController, type Control } from "react-hook-form";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion, FileValue } from "@/lib/form-types";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
    async (file: File) => {
      setUploadError(null);

      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files are accepted");
        return;
      }

      if (file.size > MAX_SIZE) {
        setUploadError("File must be under 10MB");
        return;
      }

      setPreview(URL.createObjectURL(file));
      setUploading(true);

      try {
        const ext = file.name.split(".").pop() || "jpg";
        const uuid = crypto.randomUUID();
        const appId = applicationId || "draft";
        const path = `applications/${appId}/${question.id}/${uuid}-${file.name}`;

        const signRes = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: "application-uploads",
            path,
            contentType: file.type,
          }),
        });

        if (!signRes.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { signedUrl, token } = await signRes.json();

        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
            ...(token ? { "x-upsert": "true" } : {}),
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error("Upload failed");
        }

        const value: FileValue = {
          storagePath: path,
          mimeType: file.type,
          size: file.size,
          originalName: file.name,
        };

        field.onChange(value);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Upload failed. Please try again."
        );
        setPreview(null);
        field.onChange(null);
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

  const hasValue = field.value && typeof field.value === "object" && field.value.storagePath;

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
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop an image or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Max 10MB, images only
              </p>
            </>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}
