import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  doc: null as { id: string; case_id: string; storage_path: string | null } | null,
  logged: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://signed" }, error: null }) }) },
  }),
}));
vi.mock("@/services/visas", () => ({
  getVisaDocumentById: async () => ({ data: state.doc }),
  logVisaCaseEvent: async (_c: unknown, e: Record<string, unknown>) => {
    state.logged.push(e);
    return {};
  },
}));

import { GET } from "./route";

const DOC = "d0000000-0000-0000-0000-000000000001";
const get = (id = DOC) => GET(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });

describe("GET /api/visas/documents/[id]", () => {
  beforeEach(() => {
    state.doc = null;
    state.logged = [];
  });

  it("signs a short link and logs the download", async () => {
    state.doc = { id: DOC, case_id: "c", storage_path: "c/d.pdf" };
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: "https://signed" });
    expect(state.logged).toEqual([
      { case_id: "c", actor_id: "u", kind: "document_downloaded", detail: { document_id: DOC } },
    ]);
  });

  it("is 404 when RLS hides the row, and logs nothing", async () => {
    expect((await get()).status).toBe(404);
    expect((await get("../etc")).status).toBe(404);
    expect(state.logged).toHaveLength(0);
  });
});
