"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Loader2, Eye, EyeOff } from "lucide-react";

type Status = "draft" | "published" | "cancelled" | "completed";

const STATUS_VARIANT: Record<
  Status,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  published: "default",
  cancelled: "destructive",
  completed: "secondary",
};

export function EventStatusControl({
  eventId,
  status,
}: {
  eventId: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function setStatus(next: Status) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Couldn't update status. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[status]} className="capitalize">
          {status}
        </Badge>
        {status === "draft" && (
          <Button size="sm" onClick={() => setStatus("published")} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            {busy ? "Publishing…" : "Publish event"}
          </Button>
        )}
        {status === "published" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatus("draft")}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {busy ? "Reverting…" : "Revert to draft"}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        {status === "draft" && (
          <>
            <EyeOff className="h-3 w-3" /> Draft — not visible to the public.
          </>
        )}
        {status === "published" && (
          <>
            <Eye className="h-3 w-3 text-green-600" /> Live — visible to the
            public.
          </>
        )}
        {status === "cancelled" && <>This event is cancelled.</>}
        {status === "completed" && <>This event has been completed.</>}
      </p>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
