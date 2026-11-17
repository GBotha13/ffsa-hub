// The cron route: refuses calls without the cron secret, and only asks to send on the
// live site (here: never, since tests don't run with VERCEL_ENV=production).

import { afterEach, describe, expect, it, vi } from "vitest";

const runs: { send: boolean }[] = [];
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/fleet/reminder-send", async (orig) => ({
  ...(await orig<object>()),
  runFleetReminder: vi.fn(async (_admin: unknown, opts: { send: boolean }) => {
    runs.push(opts);
    return { date: "2026-11-17", outcome: opts.send ? "sent" : "preview", reminder: { empty: false, subject: "S" } };
  }),
}));

import { GET } from "./route";

afterEach(() => {
  runs.length = 0;
  vi.unstubAllEnvs();
});

describe("GET /api/cron/fleet-reminder", () => {
  it("refuses a call without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(new Request("http://x/api/cron/fleet-reminder"));
    expect(res.status).toBe(401);
    expect(runs).toHaveLength(0);
  });

  it("builds without sending anywhere but the live site", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer s3cret" } }));
    expect(await res.json()).toMatchObject({ ok: true, outcome: "preview" });
    expect(runs).toEqual([{ send: false }]);
  });

  it("sends on the live site", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PREVIEW_WRITES_DISABLED", "");
    vi.stubEnv("FLEET_REMINDER_DISABLED", "");
    await GET(new Request("http://x", { headers: { authorization: "Bearer s3cret" } }));
    expect(runs).toEqual([{ send: true }]);
  });
});
