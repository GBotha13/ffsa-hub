"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePassword } from "@/lib/auth/password";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // The recovery link establishes a session on /auth/confirm before
      // redirecting here. No session means the link was bad or expired.
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setStatus(data.user ? "ready" : "invalid");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    if (upErr) {
      setSaving(false);
      setError(upErr.message);
      return;
    }
    // Record it for the admin security view BEFORE we drop the session.
    await fetch("/api/account/security-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "password_changed" }),
    }).catch(() => {});
    // Security: revoke every session everywhere, then have them sign in fresh.
    await supabase.auth.signOut({ scope: "global" });
    setSaving(false);
    setStatus("done");
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
        {status === "checking" && (
          <p style={{ fontSize: "11px", letterSpacing: "0.2em", color: "hsl(30 8% 42%)", textTransform: "uppercase", textAlign: "center" }}>
            Verifying your link…
          </p>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(0 60% 60%)", textTransform: "uppercase", marginBottom: "1rem" }}>
              Link expired
            </p>
            <p style={{ fontSize: "13px", color: "#C9C0B5", lineHeight: 1.7 }}>
              This password reset link is invalid or has expired. Request a fresh
              one and we&apos;ll email it right over.
            </p>
            <Link href="/forgot-password">
              <Button
                className="w-full h-11 font-bold mt-6"
                style={{ background: "hsl(42 95% 55%)", color: "#0D0B09", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: "8px" }}
              >
                Request New Link
              </Button>
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="text-center">
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "1rem" }}>
              Password updated
            </p>
            <p style={{ fontSize: "13px", color: "#C9C0B5", lineHeight: 1.7 }}>
              Your password has been changed and you&apos;ve been signed out of all
              other devices. Sign in with your new password to continue.
            </p>
            <Link href="/login">
              <Button
                className="w-full h-11 font-bold mt-6"
                style={{ background: "hsl(42 95% 55%)", color: "#0D0B09", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: "8px" }}
              >
                Continue to Sign In
              </Button>
            </Link>
          </div>
        )}

        {status === "ready" && (
          <>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(30 8% 40%)", textTransform: "uppercase", marginBottom: "1.75rem", textAlign: "center" }}>
              Choose a new password
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="password" style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "hsl(30 8% 45%)" }}>
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                  style={{ background: "hsl(20 12% 5%)", border: "1px solid hsl(22 8% 17%)", color: "#F0EBE3", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "hsl(30 8% 45%)" }}>
                  Confirm Password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                  style={{ background: "hsl(20 12% 5%)", border: "1px solid hsl(22 8% 17%)", color: "#F0EBE3", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              {error && (
                <p style={{ color: "hsl(0 72% 65%)", fontSize: "12px" }}>{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-bold transition-all duration-200"
                disabled={saving}
                style={{
                  background: saving ? "hsl(42 80% 42%)" : "hsl(42 95% 55%)",
                  color: "#0D0B09",
                  fontSize: "11px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  borderRadius: "8px",
                  marginTop: "0.5rem",
                  boxShadow: saving ? "none" : "0 4px 18px rgba(245,197,24,0.25)",
                }}
              >
                {saving ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
