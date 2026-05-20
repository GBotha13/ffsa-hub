import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById, updateCampaign, deleteCampaign } from "@/services/campaigns";
import {
  renderCampaignHtml,
  type CampaignBody,
} from "@/lib/campaigns/blocks";
import { getAuthedUser, hasAnyRole, COMMS_MANAGE_ROLES } from "@/lib/api-auth";
import type { Json } from "@/types/database";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await getCampaignById(supabase, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign: data });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, COMMS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // A sent campaign is immutable.
  const existing = await getCampaignById(supabase, id);
  if (!existing.data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (existing.data.status === "sent" || existing.data.status === "sending") {
    return NextResponse.json(
      { error: "A sent campaign can no longer be edited" },
      { status: 409 }
    );
  }

  let body: {
    name?: string;
    subject?: string;
    preview_text?: string | null;
    body_source?: CampaignBody;
    label_id?: string;
    sending_identity_id?: string;
    scheduled_at?: string | null;
    status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.subject !== undefined) patch.subject = body.subject;
  if (body.preview_text !== undefined) patch.preview_text = body.preview_text;
  if (body.label_id !== undefined) patch.label_id = body.label_id;
  if (body.sending_identity_id !== undefined)
    patch.sending_identity_id = body.sending_identity_id;
  if (body.scheduled_at !== undefined) patch.scheduled_at = body.scheduled_at;
  if (body.status !== undefined) patch.status = body.status;

  // When the body blocks change, re-render the HTML.
  if (body.body_source !== undefined) {
    patch.body_source = body.body_source as unknown as Json;
    patch.body_html = renderCampaignHtml(body.body_source, {
      previewText: body.preview_text ?? existing.data.preview_text ?? undefined,
    });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await updateCampaign(supabase, id, patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await hasAnyRole(supabase, user.id, COMMS_MANAGE_ROLES))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await deleteCampaign(supabase, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
