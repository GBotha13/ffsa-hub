"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

export function ReferenceForm({
  token,
  refereeName,
  applicantName,
  programName,
  slotLabel,
  slotDescription,
}: {
  token: string;
  refereeName: string;
  applicantName: string;
  programName: string;
  slotLabel: string;
  slotDescription: string | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [relationship, setRelationship] = useState("");
  const [knownDuration, setKnownDuration] = useState("");
  const [referenceText, setReferenceText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!referenceText.trim()) {
      setError("Please write your reference before submitting.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/public/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          relationship,
          known_duration: knownDuration,
          reference_text: referenceText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit reference. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0D0B09" }}>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: "hsl(142 55% 58%)" }} />
            <h1 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", color: "#F0EBE3", letterSpacing: "0.04em" }}>
              Thank You!
            </h1>
            <p className="text-sm" style={{ color: "#B8A898" }}>
              Your reference for {applicantName} has been submitted successfully. The admissions team will review it along with the application.
            </p>
          </div>
        </div>
        <p style={{ textAlign: "center", padding: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "hsl(30 8% 22%)", textTransform: "uppercase" }}>
          Catalyse a Generation · Evangelise the World
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0D0B09" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid hsl(22 8% 12%)" }}
      >
        <div className="flex items-center gap-3">
          <Image src="/ff-logo.png" alt="Fire & Fragrance" width={80} height={20} style={{ objectFit: "contain" }} priority />
          <div style={{ height: "1px", width: "12px", background: "var(--yellow)" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.3em", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase" }}>
            HUB
          </span>
        </div>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "hsl(30 8% 42%)", textTransform: "uppercase" }}>
          Reference Form
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div
            style={{
              background: "hsl(22 10% 8%)",
              border: "1px solid hsl(22 8% 14%)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "1.75rem 2rem 1.25rem", borderBottom: "1px solid hsl(22 8% 12%)" }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "6px" }}>
                {slotLabel}
              </p>
              <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "1.75rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                Reference for {applicantName}
              </h2>
              <p style={{ fontSize: "12px", color: "hsl(30 8% 55%)", marginTop: "6px" }}>
                Application to <strong style={{ color: "#F0EBE3" }}>{programName}</strong>
              </p>
              {slotDescription && (
                <p style={{ fontSize: "12px", color: "hsl(30 8% 45%)", marginTop: "8px" }}>
                  {slotDescription}
                </p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ padding: "1.5rem 2rem" }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="relationship">How do you know {applicantName}? *</Label>
                  <Textarea
                    id="relationship"
                    placeholder="e.g. We attend the same church, I'm their youth group leader..."
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    required
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="known_duration">How long have you known them?</Label>
                  <Input
                    id="known_duration"
                    placeholder="e.g. 3 years"
                    value={knownDuration}
                    onChange={(e) => setKnownDuration(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_text">Your Reference *</Label>
                  <Textarea
                    id="reference_text"
                    placeholder="Please share your thoughts on this person's character, faith, and suitability for the program..."
                    value={referenceText}
                    onChange={(e) => setReferenceText(e.target.value)}
                    required
                    rows={6}
                  />
                </div>

                {error && (
                  <p style={{ fontSize: "12px", color: "hsl(0 70% 65%)", padding: "10px 12px", background: "hsl(0 70% 52% / 0.08)", borderRadius: "8px", border: "1px solid hsl(0 70% 52% / 0.2)" }}>
                    {error}
                  </p>
                )}
              </div>

              <div
                className="flex justify-end"
                style={{ padding: "1rem 2rem", borderTop: "1px solid hsl(22 8% 12%)" }}
              >
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Reference"}
                </Button>
              </div>
            </form>
          </div>

          <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "hsl(30 8% 22%)", textTransform: "uppercase" }}>
            Catalyse a Generation · Evangelise the World
          </p>
        </div>
      </div>
    </div>
  );
}
