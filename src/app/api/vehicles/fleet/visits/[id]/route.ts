import { NextResponse } from "next/server";
import { saveVisit } from "@/lib/fleet/save-visit";
import { bad, fleetAuth, isUuid, readJson } from "@/lib/fleet/api";

// PUT /api/vehicles/fleet/visits/[id] — change a visit, or record the outcome of a
// booked one (status booked → done).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await fleetAuth("manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return bad("Unknown visit");
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  return saveVisit(auth, id, body);
}
