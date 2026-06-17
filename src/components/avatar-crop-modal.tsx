"use client";

import { useCallback, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import type { Area, CropperProps } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedJpegFile } from "@/lib/image";

// react-easy-crop is browser-only and a bit heavy, so load it lazily — the
// chunk is only fetched the first time someone opens the cropper. It injects
// its own styles at runtime, so there's no CSS to import.
//
// Its exported CropperProps marks defaulted props (rotation, minZoom, …) as
// required, which `dynamic` won't relax, so narrow to just the props we set.
type AvatarCropperProps = Pick<
  CropperProps,
  | "image"
  | "crop"
  | "zoom"
  | "aspect"
  | "cropShape"
  | "showGrid"
  | "onCropChange"
  | "onZoomChange"
  | "onCropComplete"
>;

const Cropper = dynamic(() => import("react-easy-crop"), {
  ssr: false,
}) as unknown as ComponentType<AvatarCropperProps>;

/**
 * Facebook/Instagram-style avatar adjuster. Given a displayable image URL,
 * lets the user drag to reposition and zoom within a circular frame, then
 * hands back the cropped square as a JPEG File. Controlled by the parent via
 * `src` (non-null = open). Mount with a `key` tied to the image so each new
 * photo starts from a clean crop.
 */
export function AvatarCropModal({
  src,
  onCancel,
  onConfirm,
}: {
  src: string | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  async function handleSave() {
    if (!src || !area) return;
    setSaving(true);
    setError(null);
    try {
      const file = await getCroppedJpegFile(src, area);
      onConfirm(file);
    } catch {
      setError("Couldn't save that crop — please try again.");
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!src} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Position your photo</DialogTitle>
          <DialogDescription>
            Drag to reposition and use the slider to zoom. The circle is how
            your avatar will appear.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-md bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-yellow-500"
            aria-label="Zoom"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !area}>
            {saving ? "Saving…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
