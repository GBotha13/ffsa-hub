import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateUser } from "@/services/users";
import { getAuthedUser, hasAnyRole } from "@/lib/api-auth";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 1024 * 1024; // 1 MB — matches the storage bucket limit.

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const ADMIN_ROLES = ["super_admin", "admin"];

// POST /api/users/[id]/avatar — multipart upload of a user's avatar.
// Anyone can upload their own avatar; super_admin / admin can upload
// for any user.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const isSelf = user.id === targetUserId;
  if (!isSelf && !(await hasAnyRole(supabase, user.id, ADMIN_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
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
      { error: "Avatar must be a PNG, JPG, or WEBP image" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Avatar must be 1 MB or smaller" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const path = `${targetUserId}/${Date.now()}.${EXT[file.type] ?? "png"}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const upload = await admin.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so freshly-uploaded avatars aren't masked by a stale public
  // URL cached at the CDN / browser (the URL is the same when the user
  // re-uploads multiple times within the same millisecond — rare but real).
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await updateUser(admin, targetUserId, {
    avatar_url: avatarUrl,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}

// DELETE /api/users/[id]/avatar — clear the user's avatar.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const isSelf = user.id === targetUserId;
  if (!isSelf && !(await hasAnyRole(supabase, user.id, ADMIN_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await updateUser(admin, targetUserId, {
    avatar_url: null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
