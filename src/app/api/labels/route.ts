import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateLabel } from "@/services/labels";
import { revalidateLabelsCache } from "@/lib/cached-reads";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

// Standalone label creation (no contact attachment). Used by the workflow
// builder's inline "+ New label" control. Idempotent on slug — re-posting the
// same name returns the existing label rather than erroring.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { name?: string; category?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "name produces an empty slug" }, { status: 400 });
  }

  const found = await findOrCreateLabel(supabase, {
    slug,
    name,
    createdBy: user.id,
    category: body.category ?? null,
  });

  if (found.error || !found.data) {
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }

  revalidateLabelsCache();

  return NextResponse.json({
    id: found.data.id,
    name: found.data.name,
    slug: found.data.slug,
  });
}
