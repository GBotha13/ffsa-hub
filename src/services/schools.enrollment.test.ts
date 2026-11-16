import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";
import { ensureEnrollmentForApplicant } from "./schools";

describe("ensureEnrollmentForApplicant", () => {
  it("returns no_account and writes nothing when no account matches the email", async () => {
    const fake = createFakeSupabase({
      resolve: (q) => {
        if (q.table === "users") return { data: null };
        return { data: null };
      },
    });

    const result = await ensureEnrollmentForApplicant(
      fake.client,
      {
        id: "app-1",
        user_id: null,
        program_id: "p1",
        applicant_email: "kathrine@example.com",
      },
      "actor"
    );

    expect(result).toEqual({ enrollmentId: null, outcome: "no_account" });
    expect(fake.queries.some((q) => q.action === "insert" || q.action === "update")).toBe(false);
  });

  it("creates an enrollment when the applicant already has an account", async () => {
    const fake = createFakeSupabase({
      resolve: (q) => {
        if (q.table === "enrollments" && q.action === "insert") return { data: { id: "enr-1" } };
        return { data: null };
      },
    });

    const result = await ensureEnrollmentForApplicant(
      fake.client,
      {
        id: "app-1",
        user_id: "user-1",
        program_id: "p1",
        applicant_email: "ada@example.com",
      },
      "actor"
    );

    expect(result).toEqual({ enrollmentId: "enr-1", outcome: "created" });
    expect(fake.queries.some((q) => q.table === "enrollments" && q.action === "insert")).toBe(true);
  });
});
