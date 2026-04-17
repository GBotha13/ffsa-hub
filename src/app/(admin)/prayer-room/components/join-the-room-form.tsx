"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Music, Mic, HandHeart, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface JoinTheRoomFormProps {
  userId: string;
}

interface Label {
  id: string;
  name: string;
  category: string;
}

const ROLES = [
  {
    value: "worship_leader",
    label: "Worship Leader",
    description: "Lead the room in sung worship",
    icon: Mic,
  },
  {
    value: "musician",
    label: "Musician",
    description: "Play an instrument on a devo set",
    icon: Music,
  },
  {
    value: "prayer_leader",
    label: "Prayer Leader",
    description: "Lead intercession and prayer",
    icon: HandHeart,
  },
];

export default function JoinTheRoomForm({ userId }: JoinTheRoomFormProps) {
  const [role, setRole] = useState<string>("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [background, setBackground] = useState("");
  const [availableInstruments, setAvailableInstruments] = useState<Label[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if user already has a request
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch(`/api/prayer-room/eval-requests/my-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) setExistingStatus(data.status);
        }
      } catch {}
      setCheckingStatus(false);
    }
    checkExisting();
  }, []);

  // Fetch instruments from labels
  useEffect(() => {
    async function fetchInstruments() {
      try {
        const res = await fetch("/api/user-labels?category=instrument");
        if (res.ok) setAvailableInstruments(await res.json());
      } catch {}
    }
    fetchInstruments();
  }, []);

  function toggleInstrument(name: string) {
    setInstruments((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      toast.error("Please select a role");
      return;
    }
    if (role === "musician" && instruments.length === 0) {
      toast.error("Please select at least one instrument");
      return;
    }
    if (!background.trim()) {
      toast.error("Please tell us a little about your background");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/prayer-room/eval-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, instruments, background }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }

      setSubmitted(true);
      toast.success("Request submitted! An admin will review it soon.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  // Already approved
  if (existingStatus === "approved") {
    return (
      <div
        className="max-w-lg mx-auto mt-6 rounded-2xl p-8 text-center"
        style={{ background: "hsl(22 10% 8%)", border: "1px solid hsl(142 60% 20%)" }}
      >
        <CheckCircle2 className="h-10 w-10 mx-auto mb-4" style={{ color: "hsl(142 60% 55%)" }} />
        <h3
          style={{
            fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
            fontSize: "1.8rem",
            letterSpacing: "0.05em",
            color: "#F0EBE3",
            marginBottom: "8px",
          }}
        >
          You're Approved!
        </h3>
        <p style={{ fontSize: "14px", color: "hsl(30 8% 50%)", lineHeight: 1.6 }}>
          Your labels have been assigned. Worship leaders can now add you to their devo set teams.
        </p>
      </div>
    );
  }

  // Pending or submitted
  if (existingStatus === "pending" || submitted) {
    return (
      <div
        className="max-w-lg mx-auto mt-6 rounded-2xl p-8 text-center"
        style={{ background: "hsl(22 10% 8%)", border: "1px solid hsl(42 95% 55% / 0.3)" }}
      >
        <Clock className="h-10 w-10 mx-auto mb-4" style={{ color: "hsl(42 95% 55%)" }} />
        <h3
          style={{
            fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
            fontSize: "1.8rem",
            letterSpacing: "0.05em",
            color: "#F0EBE3",
            marginBottom: "8px",
          }}
        >
          Request Submitted
        </h3>
        <p style={{ fontSize: "14px", color: "hsl(30 8% 50%)", lineHeight: 1.6 }}>
          Your request is pending review. An admin will assess your request and you'll be notified once approved.
        </p>
      </div>
    );
  }

  // Declined — allow resubmission
  return (
    <div className="max-w-lg mx-auto mt-4 space-y-6">

      {existingStatus === "declined" && (
        <div
          className="rounded-xl p-4"
          style={{ background: "hsl(0 72% 51% / 0.08)", border: "1px solid hsl(0 72% 51% / 0.3)" }}
        >
          <p style={{ fontSize: "13px", color: "hsl(0 72% 65%)" }}>
            Your previous request was not approved. You're welcome to apply again below.
          </p>
        </div>
      )}

      {/* Header */}
      <div>
        <p
          style={{
            fontSize: "9px",
            letterSpacing: "0.3em",
            fontWeight: 700,
            color: "hsl(42 95% 55%)",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          Prayer Room
        </p>
        <h2
          style={{
            fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
            fontSize: "2rem",
            letterSpacing: "0.04em",
            color: "#F0EBE3",
            lineHeight: 1,
          }}
        >
          Join the Room
        </h2>
        <p style={{ fontSize: "13px", color: "hsl(30 8% 48%)", marginTop: "8px", lineHeight: 1.6 }}>
          Let us know how you'd like to serve. Our team will review your request and get you connected.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Role selection */}
        <div className="space-y-2">
          <p
            style={{
              fontSize: "9px",
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "hsl(30 8% 45%)",
              textTransform: "uppercase",
            }}
          >
            How do you want to serve? *
          </p>
          <div className="grid gap-3">
            {ROLES.map(({ value, label, description, icon: Icon }) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRole(value);
                    if (value !== "musician") setInstruments([]);
                  }}
                  className="flex items-center gap-4 rounded-xl p-4 text-left transition-all duration-150"
                  style={{
                    background: active ? "hsl(42 95% 55% / 0.08)" : "hsl(22 10% 8%)",
                    border: active
                      ? "1px solid hsl(42 95% 55% / 0.5)"
                      : "1px solid hsl(22 8% 15%)",
                  }}
                >
                  <div
                    className="shrink-0 rounded-lg p-2.5"
                    style={{
                      background: active ? "hsl(42 95% 55% / 0.15)" : "hsl(22 8% 13%)",
                      color: active ? "hsl(42 95% 55%)" : "hsl(30 8% 45%)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: active ? "#F0EBE3" : "hsl(38 18% 70%)",
                      }}
                    >
                      {label}
                    </p>
                    <p style={{ fontSize: "12px", color: "hsl(30 8% 42%)", marginTop: "2px" }}>
                      {description}
                    </p>
                  </div>
                  {active && (
                    <CheckCircle2
                      className="ml-auto shrink-0 h-4 w-4"
                      style={{ color: "hsl(42 95% 55%)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Instrument picker (only for musicians) */}
        {role === "musician" && availableInstruments.length > 0 && (
          <div className="space-y-2">
            <p
              style={{
                fontSize: "9px",
                letterSpacing: "0.2em",
                fontWeight: 700,
                color: "hsl(30 8% 45%)",
                textTransform: "uppercase",
              }}
            >
              Your Instrument(s) *
            </p>
            <div className="flex flex-wrap gap-2">
              {availableInstruments.map((instr) => {
                const active = instruments.includes(instr.name);
                return (
                  <button
                    key={instr.id}
                    type="button"
                    onClick={() => toggleInstrument(instr.name)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150"
                    style={{
                      background: active ? "hsl(42 95% 55%)" : "hsl(22 10% 8%)",
                      border: active ? "1px solid hsl(42 95% 55%)" : "1px solid hsl(22 8% 15%)",
                      color: active ? "#0D0B09" : "hsl(30 8% 52%)",
                    }}
                  >
                    {instr.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Background */}
        <div className="space-y-2">
          <p
            style={{
              fontSize: "9px",
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "hsl(30 8% 45%)",
              textTransform: "uppercase",
            }}
          >
            Your Background *
          </p>
          <Textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Tell us a bit about your experience — how long you've been playing, where you've served before, your heart for worship and prayer..."
            rows={4}
            style={{
              background: "hsl(20 12% 5%)",
              border: "1px solid hsl(22 8% 17%)",
              color: "#F0EBE3",
              borderRadius: "10px",
              fontSize: "14px",
              resize: "vertical",
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-11"
          style={{
            background: "hsl(42 95% 55%)",
            color: "#0D0B09",
            fontSize: "11px",
            letterSpacing: "0.2em",
            fontWeight: 700,
            borderRadius: "10px",
            boxShadow: "0 4px 18px rgba(245,197,24,0.2)",
          }}
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </div>
  );
}
