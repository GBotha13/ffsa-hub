import { beforeEach, describe, expect, it, vi } from "vitest";

// Status changes stay with program managers. Program staff are not managers,
// so this route refuses them before it updates the application or sends mail.

const h = vi.hoisted(() => ({
  canManage: true,
  updates: 0,
  updatedIds: [] as string[],
  enrollCalls: [] as string[],
  emails: 0,
  notesError: null as string | null,
  previousStatus: "submitted",
  /** Default enrollment outcome. "created" means the applicant already has an account. */
  enrollOutcome: "created" as "created" | "existing" | "restored" | "no_account",
  /** Per-row override for a bulk mix. Missing ids use enrollOutcome. */
  outcomeById: {} as Record<string, "created" | "existing" | "restored" | "no_account">,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        in: (_column: string, ids?: string[]) => {
          const list = Array.isArray(ids) && ids.length > 0 ? ids : ["app1"];
          return Promise.resolve({
            data: list.map((id) => ({
              id,
              program_id: "p1",
              status: h.previousStatus,
              user_id: h.outcomeById[id] === "no_account" || h.enrollOutcome === "no_account" ? null : "user-1",
              applicant_email: "ada@example.com",
            })),
            error: null,
          });
        },
        eq: () => ({
          single: async () => ({ data: applicantRow("app1"), error: null }),
          maybeSingle: async () => ({ data: applicantRow("app1"), error: null }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/auth/check-schools-access", () => ({
  userCanManageApplications: async () => h.canManage,
  userCanManageProgram: async () => h.canManage,
}));
function applicantRow(id: string) {
  const outcome = h.outcomeById[id] ?? h.enrollOutcome;
  return {
    id,
    status: h.previousStatus,
    program_id: "p1",
    user_id: outcome === "no_account" ? null : "user-1",
    applicant_email: "ada@example.com",
    applicant_info: { first_name: "Ada" },
    users: { first_name: "Ada", email: "ada@example.com" },
    programs: { name: "SBI", acceptance_email_subject: null, acceptance_email_body: null },
  };
}

vi.mock("@/services/schools", () => ({
  updateResponseStatus: async (_supabase: unknown, id: string) => {
    h.updates += 1;
    h.updatedIds.push(id);
    if (h.notesError) {
      return {
        data: { id, program_id: "p1", user_id: null },
        error: { message: h.notesError },
      };
    }
    return { data: { id, program_id: "p1", user_id: "user-1" }, error: null };
  },
  createResponse: async () => ({ data: null, error: null }),
  getReferenceSlotsByProgram: async () => ({ data: [] }),
  getQuestionsByProgram: async () => ({ data: [] }),
  createReferenceRequest: async () => ({ error: null }),
  setResponseRemoved: async () => ({ error: null }),
  removeEnrollmentForApplicant: async () => {},
  ensureEnrollmentForApplicant: async (_supabase: unknown, response: { id: string }) => {
    h.enrollCalls.push(response.id);
    const outcome = h.outcomeById[response.id] ?? h.enrollOutcome;
    return {
      enrollmentId: outcome === "no_account" ? null : "enr-1",
      outcome,
    };
  },
}));
vi.mock("@/lib/auth/application-expiry", () => ({
  userCanReadApplication: async () => true,
  APPLICATIONS_EXPIRED_MESSAGE: "archived",
}));
vi.mock("@/lib/schools/demographics", () => ({ normaliseGender: () => null }));
vi.mock("@/lib/auth/membership-roles", () => ({
  ensureStudentRole: async () => {},
  deactivateMembershipProfile: async () => {},
}));
vi.mock("@/lib/email/send-transactional", () => ({
  sendTransactional: async () => {
    h.emails += 1;
    return { ok: true, id: "msg" };
  },
}));
vi.mock("@/lib/email/render-program-email", () => ({
  resolveProgramEmail: async () => ({ skip: false, subject: "Hi", html: "<p>Hi</p>" }),
}));
vi.mock("@/lib/email/send-reference-invite", () => ({ sendReferenceInvite: async () => {} }));
vi.mock("@/lib/email/send-reference-reminder", () => ({ sendReferenceReminder: async () => {} }));
vi.mock("@/lib/email/reference-email", () => ({ referenceSendConfirmed: () => false }));
vi.mock("@/lib/applications/sync-contact", () => ({ syncApplicantToContact: async () => {} }));
vi.mock("@/lib/email/templates/application-rejected", () => ({ applicationRejectedEmailHtml: () => "" }));
vi.mock("@/lib/email/templates/application-waitlisted", () => ({ applicationWaitlistedEmailHtml: () => "" }));
vi.mock("@/lib/email/templates/interview-scheduled", () => ({ interviewScheduledEmailHtml: () => "" }));

const route = await import("./route");

beforeEach(() => {
  h.canManage = true;
  h.updates = 0;
  h.updatedIds = [];
  h.enrollCalls = [];
  h.emails = 0;
  h.notesError = null;
  h.previousStatus = "submitted";
  h.enrollOutcome = "created";
  h.outcomeById = {};
});

function put(body: unknown) {
  return route.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }));
}

describe("application status changes", () => {
  it("lets a leader record an outcome", async () => {
    expect((await put({ id: "app1", status: "interview_scheduled" })).status).toBe(200);
    expect(h.updates).toBe(1);
  });

  it("refuses program staff before the application is updated", async () => {
    h.canManage = false;
    expect((await put({ id: "app1", status: "accepted", admin_notes: "no" })).status).toBe(403);
    expect(h.updates).toBe(0);
    expect(h.enrollCalls).toEqual([]);
  });

  it("returns a failed notes write instead of success", async () => {
    h.notesError = "new row violates row-level security policy";
    const res = await put({ id: "app1", status: "interview_scheduled", admin_notes: "kept" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "new row violates row-level security policy",
    });
  });

  it("returns 400 for a status the database enum does not store", async () => {
    const res = await put({ id: "app1", status: "interview_complete" });
    expect(res.status).toBe(400);
    expect(h.updates).toBe(0);
    const bulk = await put({ ids: ["app1"], status: "not-a-status" });
    expect(bulk.status).toBe(400);
    expect(h.updates).toBe(0);
  });

  it("refuses to move an accepted applicant back to submitted unless confirm is set", async () => {
    h.previousStatus = "accepted";
    const blocked = await put({ id: "app1", status: "submitted" });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe("accepted_regress");
    expect(h.updates).toBe(0);

    const allowed = await put({ id: "app1", status: "submitted", confirm_regress: true });
    expect(allowed.status).toBe(200);
    expect(h.updates).toBe(1);
  });

  it("rejects a bulk update above 100 ids", async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `app-${index}`);
    const res = await put({ ids, status: "interview_scheduled" });
    expect(res.status).toBe(400);
    expect(h.updates).toBe(0);
  });

  it("emails only when the status actually changed", async () => {
    const changed = await put({ id: "app1", status: "interview_scheduled" });
    expect(changed.status).toBe(200);
    expect(h.emails).toBe(1);

    h.previousStatus = "interview_scheduled";
    h.emails = 0;
    const same = await put({ id: "app1", status: "interview_scheduled" });
    expect(same.status).toBe(200);
    expect(h.updates).toBe(2);
    expect(h.emails).toBe(0);
  });

  it("returns a failed notes write on a bulk update", async () => {
    h.notesError = "new row violates row-level security policy";
    const res = await put({
      ids: ["app1"],
      status: "interview_scheduled",
      admin_notes: "kept",
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("new row violates row-level security policy");
  });

  it("does not persist accepted when the applicant has no account", async () => {
    h.enrollOutcome = "no_account";
    const res = await put({ id: "app1", status: "accepted" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("no_account");
    expect(body.error).toMatch(/Accept/);
    expect(body.error).toMatch(/not marked accepted/i);
    expect(h.updatedIds).toEqual([]);
    expect(h.emails).toBe(0);
  });

  it("still accepts an applicant who already has an account", async () => {
    h.enrollOutcome = "created";
    const res = await put({ id: "app1", status: "accepted" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notEnrolled).toBe(false);
    expect(h.updatedIds).toEqual(["app1"]);
    expect(h.enrollCalls).toEqual(["app1"]);
    expect(h.emails).toBe(1);
  });

  it("does not send a second acceptance email when that account is already accepted", async () => {
    h.previousStatus = "accepted";
    h.enrollOutcome = "existing";
    const res = await put({ id: "app1", status: "accepted" });
    expect(res.status).toBe(200);
    expect(h.updatedIds).toEqual(["app1"]);
    expect(h.emails).toBe(0);
  });

  it("accepts the rows that have an account and leaves no-account rows unchanged", async () => {
    h.outcomeById = { "has-account": "created", "no-account": "no_account" };
    const res = await put({
      ids: ["has-account", "no-account"],
      status: "accepted",
      send_email: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(1);
    expect(h.updatedIds).toEqual(["has-account"]);
    expect(body.notEnrolled).toEqual(["no-account"]);
    expect(body.skipped).toEqual([
      {
        id: "no-account",
        code: "no_account",
        message: expect.stringMatching(/Accept/),
      },
    ]);
    expect(h.emails).toBe(1);
  });
});
