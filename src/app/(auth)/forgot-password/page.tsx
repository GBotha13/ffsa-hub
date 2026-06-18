"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Show the same neutral confirmation even on a network error — we never
      // reveal whether the address is registered.
    }
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: "#0D0B09" }}
    >
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: "2px", background: "linear-gradient(90deg, transparent, hsl(42 95% 55%), transparent)" }}
      />

      <div className="relative mb-12 text-center animate-fade-up">
        <Image
          src="/brand/ff-wordmark-white.png"
          alt="Fire & Fragrance"
          width={260}
          height={31}
          style={{ objectFit: "contain", margin: "0 auto", display: "block" }}
          priority
        />
        <div className="flex items-center justify-center gap-4 mt-5">
          <div style={{ height: "1px", flex: 1, maxWidth: "70px", background: "hsl(22 8% 20%)" }} />
          <span style={{ fontSize: "10px", letterSpacing: "0.32em", fontWeight: 700, color: "hsl(42 95% 55%)", textTransform: "uppercase" }}>
            South Africa · Hub
          </span>
          <div style={{ height: "1px", flex: 1, maxWidth: "70px", background: "hsl(22 8% 20%)" }} />
        </div>
      </div>

      <div
        className="relative w-full max-w-sm animate-fade-up"
        style={{
          animationDelay: "60ms",
          background: "hsl(22 10% 8%)",
          border: "1px solid hsl(22 8% 15%)",
          borderRadius: "14px",
          padding: "2.25rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        {submitted ? (
          <div className="text-center">
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "1rem" }}>
              Check your inbox
            </p>
            <p style={{ fontSize: "13px", color: "#C9C0B5", lineHeight: 1.7 }}>
              If an account exists for that email, we&apos;ve sent a link to reset
              your password. It expires in 1 hour.
            </p>
            <p style={{ fontSize: "12px", color: "hsl(30 8% 40%)", lineHeight: 1.7, marginTop: "1rem" }}>
              Didn&apos;t get it? Check spam, or{" "}
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                style={{ color: "hsl(42 95% 60%)", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px" }}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(30 8% 40%)", textTransform: "uppercase", marginBottom: "0.5rem", textAlign: "center" }}>
              Reset your password
            </p>
            <p style={{ fontSize: "12px", color: "hsl(30 8% 45%)", lineHeight: 1.7, marginBottom: "1.75rem", textAlign: "center" }}>
              Enter your email and we&apos;ll send you a link to set a new one.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "hsl(30 8% 45%)" }}>
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                  style={{ background: "hsl(20 12% 5%)", border: "1px solid hsl(22 8% 17%)", color: "#F0EBE3", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-bold transition-all duration-200"
                disabled={loading}
                style={{
                  background: loading ? "hsl(42 80% 42%)" : "hsl(42 95% 55%)",
                  color: "#0D0B09",
                  fontSize: "11px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  borderRadius: "8px",
                  marginTop: "0.5rem",
                  boxShadow: loading ? "none" : "0 4px 18px rgba(245,197,24,0.25)",
                }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link href="/login" style={{ fontSize: "11px", letterSpacing: "0.08em", color: "hsl(30 8% 45%)", textDecoration: "none" }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
