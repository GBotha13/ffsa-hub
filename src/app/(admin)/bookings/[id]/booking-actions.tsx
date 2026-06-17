"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Check, X, Ban } from "lucide-react";

export function BookingActions({
  bookingId,
  status,
  hasSeries,
  canApprove,
  canCancel,
}: {
  bookingId: string;
  status: string;
  hasSeries: boolean;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [applyToSeries, setApplyToSeries] = useState(false);

  const isPending = status === "pending";
  const isActive = status === "pending" || status === "approved";

  const showDecide = canApprove && isPending;
  const showCancel = canCancel && isActive;

  if (!showDecide && !showCancel) return null;

  async function decide(decision: "approved" | "denied") {
    setBusy(decision);
    const res = await fetch(`/api/bookings/${bookingId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        note: note.trim() || null,
        applyToSeries: hasSeries && applyToSeries,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(json.error ?? "Could not update the booking.");
      return;
    }
    toast.success(
      decision === "approved" ? "Booking approved." : "Booking denied."
    );
    router.refresh();
  }

  async function cancel(seriesWide: boolean) {
    if (seriesWide && !window.confirm("Cancel every date in this weekly series?")) return;
    setBusy(seriesWide ? "cancel-series" : "cancel");
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel: true, applyToSeries: seriesWide }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(json.error ?? "Could not cancel the booking.");
      return;
    }
    toast.success(seriesWide ? "Series cancelled." : "Booking cancelled.");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {showDecide && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="decision-note">Decision note (optional)</Label>
              <textarea
                id="decision-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Approved — please confirm set-up time with the team."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            {hasSeries && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyToSeries}
                  onChange={(e) => setApplyToSeries(e.target.checked)}
                  className="rounded border-input"
                />
                Apply to all pending dates in this weekly series
              </label>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => decide("approved")}
                disabled={!!busy}
                className="gap-1 bg-emerald-600 hover:bg-emerald-600/90"
              >
                <Check className="h-4 w-4" />
                {busy === "approved" ? "Approving…" : "Approve"}
              </Button>
              <Button
                onClick={() => decide("denied")}
                disabled={!!busy}
                variant="outline"
                className="gap-1 border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <X className="h-4 w-4" />
                {busy === "denied" ? "Denying…" : "Deny"}
              </Button>
            </div>
          </div>
        )}

        {showCancel && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              onClick={() => cancel(false)}
              disabled={!!busy}
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
            >
              <Ban className="h-4 w-4" />
              {busy === "cancel" ? "Cancelling…" : "Cancel booking"}
            </Button>
            {hasSeries && (
              <Button
                onClick={() => cancel(true)}
                disabled={!!busy}
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
              >
                <Ban className="h-4 w-4" />
                {busy === "cancel-series" ? "Cancelling…" : "Cancel whole series"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
