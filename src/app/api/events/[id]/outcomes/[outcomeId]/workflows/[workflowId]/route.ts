import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, canManageEvents } from "@/lib/api-auth";
import {
  updateWorkflow,
  deleteWorkflow,
  replaceWorkflowSteps,
} from "@/services/workflows";
import type { Json } from "@/types/database";

const STEP_TYPES = ["send_email", "delay", "assign_label"];
const TRIGGER_TYPES = ["on_submit", "answer", "label_added"];

type IncomingStep = { step_type: string; config: unknown };

function validSteps(steps: unknown): steps is IncomingStep[] {
  return (
    Array.isArray(steps) &&
    steps.every(
      (s) =>
        !!s &&
        typeof s === "object" &&
        STEP_TYPES.includes((s as { step_type?: string }).step_type ?? "")
    )
  );
}

function validTrigger(trigger: unknown): boolean {
  if (!trigger || typeof trigger !== "object") return false;
  const t = (trigger as { type?: string }).type;
  return typeof t === "string" && TRIGGER_TYPES.includes(t);
}

// PATCH /api/events/[id]/outcomes/[outcomeId]/workflows/[workflowId]
// Body: { name?, trigger?, is_active?, steps? } — steps replace wholesale.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; outcomeId: string; workflowId: string }> }
) {
  const { workflowId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageEvents(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: {
    name?: string;
    trigger?: unknown;
    is_active?: boolean;
    steps?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.trigger !== undefined) {
    if (!validTrigger(body.trigger)) {
      return NextResponse.json({ error: "Invalid trigger" }, { status: 400 });
    }
    patch.trigger = body.trigger as Json;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await updateWorkflow(supabase, workflowId, patch);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.steps !== undefined) {
    if (!validSteps(body.steps)) {
      return NextResponse.json({ error: "Invalid steps" }, { status: 400 });
    }
    const r = await replaceWorkflowSteps(supabase, workflowId, body.steps);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/events/[id]/outcomes/[outcomeId]/workflows/[workflowId]
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; outcomeId: string; workflowId: string }> }
) {
  const { workflowId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageEvents(supabase, user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await deleteWorkflow(supabase, workflowId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
