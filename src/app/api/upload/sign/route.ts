import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
];

function isImageByExtension(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function POST(request: Request) {
  let body: { bucket?: string; path?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { bucket, path, contentType } = body;

  if (bucket !== "application-uploads") {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  if (!path || !path.startsWith("applications/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Accept if EITHER contentType starts with image/ OR the file extension matches
  // an image type. Mobile browsers sometimes send empty/odd contentType.
  const contentTypeOk =
    contentType && contentType.startsWith("image/");
  const extensionOk = isImageByExtension(path);

  if (!contentTypeOk && !extensionOk) {
    return NextResponse.json(
      { error: "Please choose an image file (JPG, PNG, or HEIC)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    console.error("Supabase signed upload URL error:", error);
    return NextResponse.json(
      { error: `Storage error: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
