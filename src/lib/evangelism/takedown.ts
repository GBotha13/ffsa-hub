// Who may take a testimony down, put it back, or delete it.
//
// The route and the evangelism UI both call this. The active rule is
// migration 307 (what main's database enforces today). The "moderate"
// rule matches migration 311 at 13990826 — read, not applied, not on
// main — and is selected by the constant below. One line flips the
// whole matrix, own stories and other people's.

import type { TestimonyStatus } from "@/services/evangelism";

export type OthersStoryTakedownRule = "publish" | "moderate";

/**
 * Which takedown matrix is live.
 *
 * "publish" — migration 307, what main enforces today.
 *
 * Flip this one line to "moderate" once migration 311
 * (13990826, `311_evangelism_open_publish_and_moderate.sql`) is applied.
 * That matrix is `decideAsOf311` below: `can_moderate_evangelism()` =
 * is_admin() OR evangelism.moderate. Also pass `moderate` and
 * `unscopedAdmin` through from getEvangelismAccess, or other people's
 * stories stay closed.
 */
export const OTHERS_STORY_TAKEDOWN: OthersStoryTakedownRule = "publish";

export type TakedownAccess = {
  submit: boolean;
  publish: boolean;
  /** evangelism.moderate. Ignored while OTHERS_STORY_TAKEDOWN is "publish". */
  moderate?: boolean;
  /** Unscoped admin / super_admin (is_admin()). Ignored under "publish". */
  unscopedAdmin?: boolean;
};

export type TakedownStory = {
  isMine: boolean;
  status: TestimonyStatus;
  consentToShare: boolean;
};

export type TakedownAction = "withhold" | "republish" | "delete";

export type TakedownDecision =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 409; error: string; code?: string };

const REVIEWABLE: readonly TestimonyStatus[] = ["submitted", "withheld", "published"];
const PUBLISHABLE: readonly TestimonyStatus[] = ["submitted", "withheld"];

function deny(status: 400 | 403 | 409, error: string, code?: string): TakedownDecision {
  return code ? { ok: false, status, error, code } : { ok: false, status, error };
}

/**
 * May this caller withhold, republish, or delete a story that is not theirs?
 * Defaults to OTHERS_STORY_TAKEDOWN so production has one switch.
 */
export function canActOnOthersStory(
  access: TakedownAccess,
  rule: OthersStoryTakedownRule = OTHERS_STORY_TAKEDOWN,
): boolean {
  if (rule === "moderate") return access.moderate === true || access.unscopedAdmin === true;
  return access.publish === true;
}

function othersDenied(action: TakedownAction, rule: OthersStoryTakedownRule): TakedownDecision {
  if (rule === "moderate") {
    return deny(403, "Only a ministry leader or an admin can do that to someone else's story.");
  }
  if (action === "delete") return deny(403, "Only drafts can be deleted by their author.");
  return deny(403, "Only publishers can publish or withhold.");
}

/**
 * 307, what main enforces today:
 *   withhold     — only a publisher, including the author. A publisher
 *                  may withhold their own story from any status; someone
 *                  else's only from submitted, withheld, or published.
 *   republish    — only a publisher, only from submitted or withheld,
 *                  and only with consent.
 *   delete draft — the author, with submit (delete_own_draft).
 *   delete other — only a publisher (delete_publisher covers their own
 *                  rows too). An author cannot delete a submitted,
 *                  withheld, or published story without publish.
 */
function decideAsOf307(action: TakedownAction, access: TakedownAccess, story: TakedownStory): TakedownDecision {
  if (action === "delete") {
    if (story.isMine && story.status === "draft" && access.submit) return { ok: true };
    if (story.isMine && access.publish) return { ok: true };
    if (!story.isMine && access.publish) return { ok: true };
    return othersDenied(action, "publish");
  }

  if (action === "withhold") {
    if (!story.isMine && !access.publish) return othersDenied(action, "publish");
    if (story.isMine && !access.publish) return deny(403, "Only publishers can publish or withhold.");
    if (!story.isMine && !REVIEWABLE.includes(story.status)) {
      return deny(409, "A publisher can only withhold a submitted, published or withheld story.");
    }
    return { ok: true };
  }

  // republish — publishing a submitted story uses the same transition.
  if (!story.isMine && !access.publish) return othersDenied(action, "publish");
  if (story.isMine && !access.publish) return deny(403, "Only publishers can publish or withhold.");
  if (!story.consentToShare) {
    return deny(400, "This story has no consent to share, so it can't be published.", "consent_required");
  }
  if (!PUBLISHABLE.includes(story.status)) {
    return deny(409, "Only a story that was submitted for review can be published.");
  }
  return { ok: true };
}

/**
 * 311 at 13990826. `can_submit` includes `can_publish`; `can_publish`
 * and `can_moderate` both include is_admin().
 *
 * Someone else — can_moderate_evangelism() only:
 *   withhold from submitted, withheld, or published (not a draft);
 *   publish / republish from submitted or withheld, with consent;
 *   delete any status.
 * Own story — the author branch of the guard, plus the delete policies:
 *   withhold only from published (or update an already withheld story);
 *   publish / republish only with can_publish, from submitted or withheld,
 *     with consent — moderate alone is not enough for your own story;
 *   delete own draft, published, or withheld with can_submit;
 *   a submitted story is not deletable by its author.
 *   A moderator may still delete their own submitted story, because
 *   delete_publisher is can_moderate with no author check. They cannot
 *   withhold their own draft or submitted story: that hits the author
 *   branch of the guard, which refuses it.
 */
function decideAsOf311(action: TakedownAction, access: TakedownAccess, story: TakedownStory): TakedownDecision {
  const isAdmin = access.unscopedAdmin === true;
  const publish = access.publish === true || isAdmin;
  const submit = access.submit === true || publish;
  const moderate = access.moderate === true || isAdmin;
  const canUpdateOwn = submit || moderate;

  if (action === "delete") {
    if (moderate) return { ok: true };
    if (!story.isMine) return othersDenied(action, "moderate");
    if (story.status === "submitted") return deny(403, "A submitted story can't be deleted by its author.");
    if (submit && (story.status === "draft" || story.status === "published" || story.status === "withheld")) {
      return { ok: true };
    }
    return deny(403, "You don't have permission to delete this story.");
  }

  if (action === "withhold") {
    if (story.isMine) {
      if (story.status === "published" || story.status === "withheld") {
        return canUpdateOwn ? { ok: true } : deny(403, "You don't have permission to do that.");
      }
      if (!canUpdateOwn) return deny(403, "You don't have permission to do that.");
      return deny(409, "You can only unpublish your own story once it's published.");
    }
    if (!moderate) return othersDenied(action, "moderate");
    if (!REVIEWABLE.includes(story.status)) {
      return deny(409, "A moderator can only withhold a submitted, published or withheld story.");
    }
    return { ok: true };
  }

  if (story.isMine) {
    if (!publish) return deny(403, "Only publishers can publish or withhold.");
  } else if (!moderate) {
    return othersDenied(action, "moderate");
  }
  if (!story.consentToShare) {
    return deny(400, "This story has no consent to share, so it can't be published.", "consent_required");
  }
  if (!PUBLISHABLE.includes(story.status)) {
    return deny(409, "Only a story that was submitted for review can be published.");
  }
  return { ok: true };
}

export function decideTakedown(
  action: TakedownAction,
  access: TakedownAccess,
  story: TakedownStory,
  rule: OthersStoryTakedownRule = OTHERS_STORY_TAKEDOWN,
): TakedownDecision {
  return rule === "moderate" ? decideAsOf311(action, access, story) : decideAsOf307(action, access, story);
}

/** Map a story the API already presented onto the helper's subject. */
export function takedownSubject(story: {
  is_mine: boolean;
  status: TestimonyStatus;
  consent_to_share: boolean;
}): TakedownStory {
  return { isMine: story.is_mine, status: story.status, consentToShare: story.consent_to_share };
}

export type TakedownSurface = "feed" | "mine";

/**
 * Controls the screens actually render. A control is shown only when
 * decideTakedown would allow it, and only on the surface that owns it:
 *   feed — Unpublish and Delete on published stories
 *   mine — Delete on the author's draft, submitted, and withheld stories;
 *          Publish again on a withheld story the caller may republish
 */
export function visibleTakedownControls(
  surface: TakedownSurface,
  access: TakedownAccess,
  story: TakedownStory,
  rule: OthersStoryTakedownRule = OTHERS_STORY_TAKEDOWN,
): { withhold: boolean; delete: boolean; republish: boolean } {
  const allowed = (action: TakedownAction) => decideTakedown(action, access, story, rule).ok;
  if (surface === "feed") {
    const published = story.status === "published";
    return {
      withhold: published && allowed("withhold"),
      delete: published && allowed("delete"),
      republish: false,
    };
  }
  const ownRemovable =
    story.isMine && (story.status === "draft" || story.status === "submitted" || story.status === "withheld");
  return {
    withhold: false,
    delete: ownRemovable && allowed("delete"),
    republish: story.status === "withheld" && allowed("republish"),
  };
}

// ── PATCH body ────────────────────────────────────────────
// Publisher review is either the queue's `{ action }` or `{ status }`
// (the shape a takedown client sends). Content keys mean "edit the
// story", which stays locked once a story is published or withheld.

const CONTENT_KEYS = [
  "title",
  "body",
  "occurred_on",
  "location_label",
  "staff_ministry_id",
  "people_reached",
  "decisions",
  "outcome",
  "consent_to_share",
  "intent",
  "photo",
  "remove_photo",
] as const;

export type ClassifiedPatch =
  | { kind: "withhold"; reason: string | null }
  | { kind: "republish" }
  | { kind: "edit" }
  | { kind: "mixed" }
  | { kind: "invalid"; error: string };

function readReason(body: Record<string, unknown>): { ok: true; reason: string | null } | { ok: false; error: string } {
  const raw = body.reason !== undefined ? body.reason : body.withheld_reason;
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    return { ok: false, error: "The reason has to be text." };
  }
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };
  return { ok: true, reason: reason || null };
}

/** Split a PATCH body into a review, an author edit, or a rejection. */
export function classifyPatch(body: Record<string, unknown>): ClassifiedPatch {
  const action = body.action;
  if (action !== undefined && action !== "publish" && action !== "withhold") {
    return { kind: "invalid", error: "Unknown review action." };
  }
  const wantsWithhold = action === "withhold" || (action === undefined && body.status === "withheld");
  const wantsRepublish = action === "publish" || (action === undefined && body.status === "published");
  const hasContent = CONTENT_KEYS.some((key) => body[key] !== undefined);
  if ((wantsWithhold || wantsRepublish) && hasContent) return { kind: "mixed" };
  if (wantsWithhold) {
    const reason = readReason(body);
    if (!reason.ok) return { kind: "invalid", error: reason.error };
    return { kind: "withhold", reason: reason.reason };
  }
  if (wantsRepublish) return { kind: "republish" };
  return { kind: "edit" };
}
