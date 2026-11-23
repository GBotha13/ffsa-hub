import { NextResponse } from "next/server";
import { bad, fleetAuth, isUuid, logTime, readJson } from "@/lib/fleet/api";
import { fixEntry } from "@/lib/fleet/fixes";
import { todayInSA } from "@/lib/fleet/rules";
import type { ConditionEntry } from "@/lib/fleet/rules/types";
import { getFleetVehicle, updateFleetVehicleDetails } from "@/services/fleet";

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST /api/vehicles/fleet/vehicles/[id]/fixed — "Mark as fixed" on a Fix now point.
// Body: { itemId, date, by, work }. The point goes back to OK as of `date`, with who fixed
// it and what was done; the next inspection that checks it overrides it as usual.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await fleetAuth("manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return bad("Unknown vehicle");
  const b = await readJson<{ itemId?: string; date?: string; by?: string; work?: string }>(request);
  const itemId = String(b?.itemId || "");
  if (!itemId || itemId.length > 60) return bad("Unknown point");

  const { data: row, error: getErr } = await getFleetVehicle(auth.supabase, id);
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  const details: any = row && (Array.isArray(row.details) ? row.details[0] : row.details);
  if (!details) return bad("Unknown vehicle", 404);
  const condition: Record<string, ConditionEntry> = details.condition || {};

  const r = fixEntry(condition[itemId], { itemId, date: String(b?.date || ""), by: String(b?.by || ""), work: String(b?.work || "") }, todayInSA(), auth.user.id);
  if ("error" in r) return bad(r.error, condition[itemId]?.s === "fix" ? 400 : 409);

  const { error } = await updateFleetVehicleDetails(auth.supabase, id, { condition: { ...condition, [itemId]: r.entry }, updated_by: auth.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logTime(auth.supabase, auth.user.id, { kind: "workshop", vehicleId: id, mins: 1 });
  return NextResponse.json({ success: true, message: "Marked as fixed." });
}
