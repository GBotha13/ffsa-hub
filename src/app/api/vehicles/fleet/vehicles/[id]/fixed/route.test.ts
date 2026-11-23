// POST /api/vehicles/fleet/vehicles/[id]/fixed — "Mark as fixed" (Gideon, 23 Nov 2026).

import { beforeEach, describe, expect, it, vi } from "vitest";

const V = "00000000-0000-0000-0000-000000000004";
let condition: Record<string, unknown> = {};
let canManage = true;
const writes: Record<string, unknown>[] = [];

vi.mock("@/lib/fleet/api", async (orig) => ({
  ...(await orig<object>()),
  fleetAuth: async () => (canManage ? { ok: true, supabase: {}, user: { id: "u1" }, access: {} } : { ok: false, response: new Response(null, { status: 403 }) }),
  logTime: vi.fn(async () => {}),
}));
vi.mock("@/lib/fleet/rules", async (orig) => ({ ...(await orig<object>()), todayInSA: () => "2026-11-23" }));
vi.mock("@/services/fleet", () => ({
  getFleetVehicle: async () => ({ data: { id: V, details: { condition } }, error: null }),
  updateFleetVehicleDetails: vi.fn(async (_s: unknown, _id: string, patch: Record<string, unknown>) => (writes.push(patch), { data: {}, error: null })),
}));

import { POST } from "./route";

const req = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = { params: Promise.resolve({ id: V }) };

beforeEach(() => {
  writes.length = 0;
  canManage = true;
  condition = {
    "m25-balljoints": { s: "fix", d: "2026-11-19", n: "4x lower control arm bushes worn", i: "ins-1", t: "Ball joints and control arms" },
    "m25-oil": { s: "ok", d: "2026-11-19", i: "ins-1" },
  };
});

describe("Mark as fixed", () => {
  it("sets the point to OK with who and what, and leaves the other points alone", async () => {
    const res = await POST(req({ itemId: "m25-balljoints", date: "2026-11-22", by: "Motech", work: "Replaced the bushes." }), params);
    expect(res.status).toBe(200);
    const cond = writes[0].condition as Record<string, Record<string, unknown>>;
    expect(cond["m25-balljoints"]).toMatchObject({ s: "ok", d: "2026-11-22", n: "Fixed by Motech: Replaced the bushes.", f: { by: "Motech", work: "Replaced the bushes.", recordedBy: "u1", was: { s: "fix" } } });
    expect(cond["m25-oil"]).toEqual(condition["m25-oil"]);
  });

  it("refuses a point that isn't Fix now, and bad input", async () => {
    expect((await POST(req({ itemId: "m25-oil", date: "2026-11-22", by: "Motech", work: "x" }), params)).status).toBe(409);
    expect((await POST(req({ itemId: "m25-balljoints", date: "2026-11-22", by: "", work: "x" }), params)).status).toBe(400);
    expect((await POST(req({ itemId: "", date: "2026-11-22", by: "M", work: "x" }), params)).status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("needs Fleet manage access", async () => {
    canManage = false;
    expect((await POST(req({ itemId: "m25-balljoints", date: "2026-11-22", by: "M", work: "x" }), params)).status).toBe(403);
  });
});
