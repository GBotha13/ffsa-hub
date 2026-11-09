import { describe, expect, it } from "vitest";
import {
  OTHERS_STORY_TAKEDOWN,
  canActOnOthersStory,
  classifyPatch,
  decideTakedown,
  visibleTakedownControls,
  type TakedownAccess,
  type TakedownStory,
} from "./takedown";

const publisher: TakedownAccess = { submit: true, publish: true };
const submitter: TakedownAccess = { submit: true, publish: false };
const viewer: TakedownAccess = { submit: false, publish: false };
const moderator: TakedownAccess = { submit: true, publish: true, moderate: true };
const adminOnly: TakedownAccess = { submit: true, publish: true, unscopedAdmin: true };

function story(over: Partial<TakedownStory> = {}): TakedownStory {
  return { isMine: false, status: "published", consentToShare: true, ...over };
}

describe("OTHERS_STORY_TAKEDOWN", () => {
  it("ships on migration 307's publish rule", () => {
    expect(OTHERS_STORY_TAKEDOWN).toBe("publish");
    expect(canActOnOthersStory(publisher)).toBe(true);
    expect(canActOnOthersStory(submitter)).toBe(false);
    // The moderate flag does nothing until the constant is flipped.
    expect(canActOnOthersStory({ ...submitter, moderate: true })).toBe(false);
    expect(canActOnOthersStory({ submit: false, publish: false, unscopedAdmin: true })).toBe(false);
  });

  it("moderate variant: ministry leaders and unscoped admins, not plain publishers", () => {
    expect(canActOnOthersStory(publisher, "moderate")).toBe(false);
    expect(canActOnOthersStory(moderator, "moderate")).toBe(true);
    expect(canActOnOthersStory(adminOnly, "moderate")).toBe(true);
    expect(canActOnOthersStory({ submit: false, publish: false, unscopedAdmin: true }, "moderate")).toBe(true);
    expect(canActOnOthersStory(submitter, "moderate")).toBe(false);
  });
});

describe("decideTakedown — publish rule (307, active)", () => {
  it("lets a publisher withhold a published story, own or someone else's", () => {
    expect(decideTakedown("withhold", publisher, story())).toEqual({ ok: true });
    expect(decideTakedown("withhold", publisher, story({ isMine: true }))).toEqual({ ok: true });
  });

  it("lets a publisher withhold submitted and withheld stories, not someone else's draft", () => {
    expect(decideTakedown("withhold", publisher, story({ status: "submitted" })).ok).toBe(true);
    expect(decideTakedown("withhold", publisher, story({ status: "withheld" })).ok).toBe(true);
    const draft = decideTakedown("withhold", publisher, story({ status: "draft" }));
    expect(draft.ok).toBe(false);
    if (!draft.ok) expect(draft.status).toBe(409);
  });

  it("lets a publisher withhold their own draft — 307's guard only limits other people's", () => {
    expect(decideTakedown("withhold", publisher, story({ isMine: true, status: "draft" })).ok).toBe(true);
  });

  it("refuses a non-publisher, including the author", () => {
    for (const access of [submitter, viewer]) {
      for (const isMine of [true, false]) {
        const decision = decideTakedown("withhold", access, story({ isMine }));
        expect(decision.ok).toBe(false);
        if (!decision.ok) expect(decision.status).toBe(403);
      }
    }
  });

  it("republishes only from submitted or withheld, and only with consent", () => {
    expect(decideTakedown("republish", publisher, story({ status: "withheld" })).ok).toBe(true);
    expect(decideTakedown("republish", publisher, story({ status: "submitted" })).ok).toBe(true);
    const published = decideTakedown("republish", publisher, story({ status: "published" }));
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.status).toBe(409);
    const noConsent = decideTakedown("republish", publisher, story({ status: "withheld", consentToShare: false }));
    expect(noConsent.ok).toBe(false);
    if (!noConsent.ok) {
      expect(noConsent.status).toBe(400);
      expect(noConsent.code).toBe("consent_required");
    }
  });

  it("checks permission before consent, so a non-publisher is refused rather than told about consent", () => {
    const decision = decideTakedown("republish", submitter, story({ status: "submitted", consentToShare: false, isMine: true }));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.status).toBe(403);
  });

  it("lets the author delete their own draft, and a publisher delete any story", () => {
    expect(decideTakedown("delete", submitter, story({ isMine: true, status: "draft" })).ok).toBe(true);
    expect(decideTakedown("delete", publisher, story({ status: "published" })).ok).toBe(true);
    expect(decideTakedown("delete", publisher, story({ isMine: true, status: "submitted" })).ok).toBe(true);
    expect(decideTakedown("delete", publisher, story({ isMine: true, status: "withheld" })).ok).toBe(true);
    expect(decideTakedown("delete", publisher, story({ isMine: true, status: "draft", consentToShare: false })).ok).toBe(true);
  });

  it("refuses an author delete of submitted, withheld, or published stories", () => {
    for (const status of ["submitted", "withheld", "published"] as const) {
      const decision = decideTakedown("delete", submitter, story({ isMine: true, status }));
      expect(decision.ok).toBe(false);
      if (!decision.ok) expect(decision.status).toBe(403);
    }
  });

  it("refuses a viewer deleting their own draft — submit is required", () => {
    expect(decideTakedown("delete", viewer, story({ isMine: true, status: "draft" })).ok).toBe(false);
  });
});

describe("decideTakedown — moderate variant (311 at 13990826, not active)", () => {
  const moderateOnly: TakedownAccess = { submit: false, publish: false, moderate: true };
  const bareAdmin: TakedownAccess = { submit: false, publish: false, unscopedAdmin: true };

  it("blocks a plain publisher from someone else's story", () => {
    for (const action of ["withhold", "republish", "delete"] as const) {
      const decision = decideTakedown(action, publisher, story({ status: action === "republish" ? "withheld" : "published" }), "moderate");
      expect(decision.ok).toBe(false);
      if (!decision.ok) expect(decision.status).toBe(403);
    }
  });

  it("lets a moderator or unscoped admin act on someone else's story", () => {
    const published = story();
    const withheld = story({ status: "withheld" });
    for (const access of [moderator, adminOnly, moderateOnly, bareAdmin]) {
      expect(decideTakedown("withhold", access, published, "moderate").ok).toBe(true);
      expect(decideTakedown("republish", access, withheld, "moderate").ok).toBe(true);
      expect(decideTakedown("delete", access, published, "moderate").ok).toBe(true);
    }
  });

  it("lets an author unpublish and delete their own published or withheld story without moderate", () => {
    expect(decideTakedown("withhold", submitter, story({ isMine: true, status: "published" }), "moderate").ok).toBe(true);
    expect(decideTakedown("withhold", submitter, story({ isMine: true, status: "withheld" }), "moderate").ok).toBe(true);
    expect(decideTakedown("delete", submitter, story({ isMine: true, status: "published" }), "moderate").ok).toBe(true);
    expect(decideTakedown("delete", submitter, story({ isMine: true, status: "withheld" }), "moderate").ok).toBe(true);
    expect(decideTakedown("delete", submitter, story({ isMine: true, status: "draft" }), "moderate").ok).toBe(true);
  });

  it("refuses an author withhold of their own draft or submitted story, even for a moderator", () => {
    for (const status of ["draft", "submitted"] as const) {
      for (const access of [submitter, publisher, moderateOnly]) {
        const decision = decideTakedown("withhold", access, story({ isMine: true, status }), "moderate");
        expect(decision.ok).toBe(false);
        if (!decision.ok) expect(decision.status).toBe(409);
      }
    }
  });

  it("refuses a moderator withhold of someone else's draft", () => {
    const decision = decideTakedown("withhold", moderateOnly, story({ status: "draft" }), "moderate");
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.status).toBe(409);
  });

  it("lets the author republish their own story only with publish and consent", () => {
    expect(decideTakedown("republish", publisher, story({ isMine: true, status: "withheld" }), "moderate").ok).toBe(true);
    expect(decideTakedown("republish", publisher, story({ isMine: true, status: "submitted" }), "moderate").ok).toBe(true);
    const author = decideTakedown("republish", submitter, story({ isMine: true, status: "withheld" }), "moderate");
    expect(author.ok).toBe(false);
    if (!author.ok) expect(author.status).toBe(403);
    // Moderate alone publishes someone else's story, not the moderator's own.
    expect(decideTakedown("republish", moderateOnly, story({ status: "submitted" }), "moderate").ok).toBe(true);
    const own = decideTakedown("republish", moderateOnly, story({ isMine: true, status: "withheld" }), "moderate");
    expect(own.ok).toBe(false);
    if (!own.ok) expect(own.status).toBe(403);
    const noConsent = decideTakedown(
      "republish",
      publisher,
      story({ isMine: true, status: "withheld", consentToShare: false }),
      "moderate",
    );
    expect(noConsent.ok).toBe(false);
    if (!noConsent.ok) expect(noConsent.status).toBe(400);
  });

  it("does not let an author delete their own submitted story unless they moderate", () => {
    const author = decideTakedown("delete", publisher, story({ isMine: true, status: "submitted" }), "moderate");
    expect(author.ok).toBe(false);
    if (!author.ok) expect(author.status).toBe(403);
    expect(decideTakedown("delete", moderateOnly, story({ isMine: true, status: "submitted" }), "moderate").ok).toBe(true);
    expect(decideTakedown("delete", moderateOnly, story({ status: "draft" }), "moderate").ok).toBe(true);
  });

  it("treats an unscoped admin as is_admin(), which implies publish, submit, and moderate", () => {
    expect(decideTakedown("republish", bareAdmin, story({ isMine: true, status: "withheld" }), "moderate").ok).toBe(true);
    expect(decideTakedown("withhold", bareAdmin, story({ isMine: true, status: "published" }), "moderate").ok).toBe(true);
    expect(decideTakedown("delete", bareAdmin, story({ isMine: true, status: "draft" }), "moderate").ok).toBe(true);
  });
});

describe("visibleTakedownControls", () => {
  it("shows Unpublish and Delete on the feed only for a publisher, and only when published", () => {
    expect(visibleTakedownControls("feed", publisher, story())).toEqual({
      withhold: true,
      delete: true,
      republish: false,
    });
    expect(visibleTakedownControls("feed", submitter, story({ isMine: true }))).toEqual({
      withhold: false,
      delete: false,
      republish: false,
    });
    expect(visibleTakedownControls("feed", publisher, story({ status: "withheld" })).withhold).toBe(false);
  });

  it("shows Delete on My stories for the author's draft (submitter) and for a publisher's submitted and withheld", () => {
    expect(visibleTakedownControls("mine", submitter, story({ isMine: true, status: "draft" })).delete).toBe(true);
    expect(visibleTakedownControls("mine", submitter, story({ isMine: true, status: "submitted" })).delete).toBe(false);
    expect(visibleTakedownControls("mine", submitter, story({ isMine: true, status: "withheld" })).delete).toBe(false);
    expect(visibleTakedownControls("mine", publisher, story({ isMine: true, status: "submitted" })).delete).toBe(true);
    expect(visibleTakedownControls("mine", publisher, story({ isMine: true, status: "withheld" })).delete).toBe(true);
    expect(visibleTakedownControls("mine", publisher, story({ isMine: true, status: "draft" })).delete).toBe(true);
  });

  it("does not show Delete on a published story in My stories — that control lives on the feed", () => {
    expect(visibleTakedownControls("mine", publisher, story({ isMine: true, status: "published" })).delete).toBe(false);
  });

  it("does not show Delete on someone else's story in My stories", () => {
    expect(visibleTakedownControls("mine", publisher, story({ isMine: false, status: "draft" })).delete).toBe(false);
  });

  it("shows Publish again on a withheld story the caller may republish", () => {
    expect(visibleTakedownControls("mine", publisher, story({ isMine: true, status: "withheld" })).republish).toBe(true);
    expect(visibleTakedownControls("mine", submitter, story({ isMine: true, status: "withheld" })).republish).toBe(false);
    expect(visibleTakedownControls("mine", publisher, story({ isMine: true, status: "withheld", consentToShare: false })).republish).toBe(
      false,
    );
  });

  it("hides others'-story feed controls under the moderate rule unless they moderate", () => {
    expect(visibleTakedownControls("feed", publisher, story(), "moderate")).toEqual({
      withhold: false,
      delete: false,
      republish: false,
    });
    expect(visibleTakedownControls("feed", moderator, story(), "moderate").withhold).toBe(true);
    expect(visibleTakedownControls("feed", publisher, story({ isMine: true }), "moderate").withhold).toBe(true);
  });
});

describe("classifyPatch", () => {
  it("reads a withhold from status or action, with an optional reason", () => {
    expect(classifyPatch({ status: "withheld", reason: "  Names a minor " })).toEqual({
      kind: "withhold",
      reason: "Names a minor",
    });
    expect(classifyPatch({ status: "withheld" })).toEqual({ kind: "withhold", reason: null });
    expect(classifyPatch({ status: "withheld", reason: "   " })).toEqual({ kind: "withhold", reason: null });
    expect(classifyPatch({ status: "withheld", withheld_reason: "Not this week" })).toEqual({
      kind: "withhold",
      reason: "Not this week",
    });
    expect(classifyPatch({ action: "withhold", reason: "Queue" })).toEqual({ kind: "withhold", reason: "Queue" });
  });

  it("reads republish from status or action", () => {
    expect(classifyPatch({ status: "published" })).toEqual({ kind: "republish" });
    expect(classifyPatch({ action: "publish" })).toEqual({ kind: "republish" });
  });

  it("rejects an oversized or non-text reason", () => {
    expect(classifyPatch({ status: "withheld", reason: "x".repeat(501) })).toEqual({
      kind: "invalid",
      error: "Keep the reason under 500 characters.",
    });
    expect(classifyPatch({ action: "withhold", reason: 12 }).kind).toBe("invalid");
  });

  it("treats content and consent as an edit, and refuses them mixed into a review", () => {
    expect(classifyPatch({ title: "A new title", intent: "draft" }).kind).toBe("edit");
    expect(classifyPatch({ consent_to_share: false }).kind).toBe("edit");
    expect(classifyPatch({ status: "withheld", title: "Sneaky" }).kind).toBe("mixed");
    expect(classifyPatch({ action: "publish", consent_to_share: true }).kind).toBe("mixed");
  });

  it("rejects an unknown action", () => {
    expect(classifyPatch({ action: "delete" }).kind).toBe("invalid");
  });
});
