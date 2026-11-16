import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  email: "Ada_Smith@Example.com",
  status: "submitted",
  userId: null as string | null,
  /** Existing users row. Null means the applicant has no account yet. */
  account: { id: "user-1", first_name: "Ada" } as { id: string; first_name: string } | null,
  /** Existing enrollment. Null means Accept still has to create one. */
  enrollment: null as { id: string } | null,
  filters: [] as Array<{ table: string; op: string; column: string; value: unknown }>,
  writes: [] as string[],
  billing: 0,
  emails: 0,
}));

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const self = () => b;
  b.select = self;
  b.insert = () => {
    h.writes.push(`insert:${table}`);
    return b;
  };
  b.update = () => {
    h.writes.push(`update:${table}`);
    return b;
  };
  b.delete = self;
  b.eq = (column: string, value: unknown) => {
    h.filters.push({ table, op: "eq", column, value });
    return b;
  };
  b.ilike = (column: string, value: unknown) => {
    h.filters.push({ table, op: "ilike", column, value });
    return b;
  };
  b.single = async () => {
    if (table === "application_responses") return { data: applicationRow(), error: null };
    if (table === "enrollments") return { data: { id: "enr-1" }, error: null };
    return { data: null, error: null };
  };
  b.maybeSingle = async () => {
    if (table === "users") return { data: h.account, error: null };
    if (table === "enrollments") return { data: h.enrollment, error: null };
    if (table === "application_responses") return { data: applicationRow(), error: null };
    return { data: null, error: null };
  };
  b.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
  }),
}));
function applicationRow() {
  return {
    id: "app1",
    user_id: h.userId,
    status: h.status,
    program_id: "p1",
    applicant_email: h.email,
    applicant_info: { first_name: "Ada", last_name: "Smith", email: h.email },
    programs: {
      id: "p1",
      name: "Test",
      code: "T",
      acceptance_email_subject: null,
      acceptance_email_body: null,
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => builder(table),
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "new-user" } }, error: null }),
      },
    },
  }),
}));
vi.mock("@/lib/auth/check-schools-access", () => ({ userCanManageProgram: async () => true }));
vi.mock("@/lib/auth/application-expiry", () => ({
  userCanReadApplication: async () => true,
  APPLICATIONS_EXPIRED_MESSAGE: "expired",
}));
vi.mock("@/lib/auth/membership-roles", () => ({ ensureStudentRole: async () => {} }));
vi.mock("@/lib/auth/onboarding-invite", () => ({
  createOnboardingInvite: async () => ({ ok: true, token: "tok", url: "https://hub.test/setup/tok" }),
}));
vi.mock("@/lib/schools/setup-invite-schedule", () => ({
  resolveSetupInviteDueDate: async () => null,
  formatInviteDate: () => "",
}));
vi.mock("@/services/billing-generation", () => ({
  setupProgramBillingOnAcceptance: async () => {
    h.billing += 1;
    return { ok: true };
  },
}));
vi.mock("@/lib/email/send-transactional", () => ({
  sendTransactional: async () => {
    h.emails += 1;
    return { ok: true, id: "msg" };
  },
}));

import { POST } from "./route";

function post() {
  return POST(
    new Request("https://hub.test/api/admin/accept-application", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_id: "app1" }),
    })
  );
}

describe("POST /api/admin/accept-application email match", () => {
  beforeEach(() => {
    h.email = "Ada_Smith@Example.com";
    h.status = "submitted";
    h.userId = null;
    h.account = { id: "user-1", first_name: "Ada" };
    h.enrollment = null;
    h.filters = [];
    h.writes = [];
    h.billing = 0;
    h.emails = 0;
  });

  it("matches an existing user with an escaped case-insensitive email", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(h.filters).toContainEqual({
      table: "users",
      op: "ilike",
      column: "email",
      value: "ada\\_smith@example.com",
    });
    expect(h.filters.some((f) => f.table === "users" && f.op === "eq" && f.column === "email")).toBe(false);
  });

  it("finishes an application that is already accepted but has no enrollment", async () => {
    h.status = "accepted";
    h.userId = null;
    h.account = null;
    h.enrollment = null;
    const res = await post();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.error).toBeUndefined();
    expect(h.writes).toContain("insert:enrollments");
    expect(h.billing).toBe(1);
    expect(h.emails).toBe(1);
  });

  it("refuses an application that is already accepted and already enrolled", async () => {
    h.status = "accepted";
    h.userId = "user-1";
    h.account = { id: "user-1", first_name: "Ada" };
    h.enrollment = { id: "enr-existing" };
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This application has already been accepted",
    });
    expect(h.writes).toEqual([]);
    expect(h.billing).toBe(0);
    expect(h.emails).toBe(0);
  });

  it("rejects * before the user lookup and does not accept the application", async () => {
    h.email = "a*@gmail.com";
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This applicant's email can't be matched safely." });
    expect(h.filters.some((f) => f.table === "users")).toBe(false);
    expect(h.filters.some((f) => f.op === "ilike")).toBe(false);
  });
});
