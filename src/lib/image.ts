// Client-side image normalization for avatar uploads.
//
// Avatars are resized + re-encoded in the browser before upload so we never
// ship a large file over the wire and never hit the 1 MB `avatars` storage
// bucket limit (see src/app/api/users/[id]/avatar/route.ts). The stored image
// is always a small JPEG. iPhone HEIC/HEIF photos are decoded first — browsers
// can't draw HEIC onto a canvas — then compressed like everything else.

const DEFAULT_MAX_DIMENSION = 512; // longest side in px — generous for an avatar
const DEFAULT_MAX_BYTES = 900 * 1024; // stay comfortably under the 1 MB bucket cap
const START_QUALITY = 0.85;
const MIN_QUALITY = 0.4; // floor so we never degrade to mush
const QUALITY_STEP = 0.1;

type CompressOptions = {
  maxDimension?: number;
  maxBytes?: number;
};

// Best-effort MIME detection — file.type is sometimes empty or wrong for HEIC.
function detectType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function isHeic(type: string, file: File): boolean {
  if (type === "image/heic" || type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

// Decode a HEIC/HEIF file to a JPEG blob via heic2any, loaded lazily so the
// heavy decoder is only fetched by clients that actually upload a HEIC.
async function heicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
}

/**
 * Resize and re-encode an image so the result is a JPEG no larger than
 * `maxBytes`. Returns a fresh `.jpg` File. On any failure it returns the
 * original file unchanged, so the upload still gets a chance to succeed (and
 * the server-side size/type checks remain the final backstop).
 */
export async function compressImageToMaxBytes(
  file: File,
  {
    maxDimension = DEFAULT_MAX_DIMENSION,
    maxBytes = DEFAULT_MAX_BYTES,
  }: CompressOptions = {}
): Promise<File> {
  try {
    const type = detectType(file);
    const source: Blob = isHeic(type, file) ? await heicToJpeg(file) : file;

    const img = await loadImage(source);

    let { width, height } = img;
    if (!width || !height) return file;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // White matte so transparent PNGs don't flatten to black when encoded
    // as JPEG. Avatars are circle-cropped on display, so this only shows
    // through genuine interior transparency (rare for a profile photo).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = START_QUALITY;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > maxBytes && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
      blob = await canvasToBlob(canvas, quality);
    }
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "").trim() || "avatar";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
