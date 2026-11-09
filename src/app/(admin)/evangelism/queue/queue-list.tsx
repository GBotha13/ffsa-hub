"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { patchStory } from "@/lib/evangelism/story-client";
import { decideTakedown, takedownSubject, type TakedownAccess } from "@/lib/evangelism/takedown";
import type { PresentedTestimony } from "@/services/evangelism";
import { StoryCard } from "../story-card";

function QueueItem({ story, access }: { story: PresentedTestimony; access: TakedownAccess }) {
  const router = useRouter();
  const [withholding, setWithholding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subject = takedownSubject(story);
  // Consent is shown as a disabled publish button, so ask the helper as if
  // consent were present and then disable on the real flag.
  const canWithhold = decideTakedown("withhold", access, subject).ok;
  const canPublish = decideTakedown("republish", access, { ...subject, consentToShare: true }).ok;

  async function review(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    const result = await patchStory(story.id, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success(done);
    router.refresh();
  }

  return (
    <StoryCard story={story} showStatus>
      {!story.consent_to_share && (
        <p className="mt-3 text-sm text-red-700">No consent to share — this story can&apos;t be published.</p>
      )}
      {withholding ? (
        <div className="mt-4 min-w-0 space-y-3">
          <Textarea
            className="min-h-24 w-full max-w-full text-base md:text-sm"
            placeholder="Why is it being withheld? (optional — the author can see this)"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={() => review({ action: "withhold", reason }, "Withheld")}
            >
              Confirm withhold
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={() => setWithholding(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        (canPublish || canWithhold) && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canPublish && (
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                disabled={busy || !story.consent_to_share}
                onClick={() => review({ action: "publish" }, "Published")}
              >
                Approve &amp; publish
              </Button>
            )}
            {canWithhold && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                disabled={busy}
                onClick={() => setWithholding(true)}
              >
                Withhold
              </Button>
            )}
          </div>
        )
      )}
      {error && (
        <p role="alert" className="mt-3 break-words text-sm text-red-700">
          {error}
        </p>
      )}
    </StoryCard>
  );
}

export function QueueList({ stories, access }: { stories: PresentedTestimony[]; access: TakedownAccess }) {
  if (stories.length === 0) {
    return <p className="px-5 py-6 text-sm text-[color:var(--text-secondary)] md:px-8">Nothing waiting for review.</p>;
  }
  return (
    <>
      {stories.map((s) => (
        <QueueItem key={s.id} story={s} access={access} />
      ))}
    </>
  );
}
