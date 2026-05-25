import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthedUser,
  hasAnyRole,
  COMMS_MANAGE_ROLES,
} from "@/lib/api-auth";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// POST /api/campaigns/[id]/image — multipart upload of an in-email image.
// Saves to the campaign-images bucket and returns the public URL the block
// editor stores on the image block.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, COMMS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Confirm the campaign exists so we never write orphan blobs.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Image must be PNG, JPG, WEBP, or GIF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 10 MB or smaller" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const path = `${campaignId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${EXT[file.type] ?? "png"}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const upload = await admin.storage
    .from("campaign-images")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const { data: pub } = admin.storage
    .from("campaign-images")
    .getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
