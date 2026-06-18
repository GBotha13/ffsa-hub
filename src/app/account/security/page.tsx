"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePassword } from "@/lib/auth/password";
import { ArrowLeft } from "lucide-react";

export default function SecurityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace("/login?redirect=/account/security");
        return;
      }
      setEmail(data.user.email ?? null);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) return;

    const pwErr = validatePassword(next);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (next === current) {
      setError("Your new password must be different from your current one.");
      return;
    }

    setSaving(true);
    // Confirm the current password by re-authenticating before we change it.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthErr) {
      setSaving(false);
      setError("Your current password is incorrect.");
      return;
    }

    const { error: upErr } = await supabase.auth.updateUser({ password: next });
    if (upErr) {
      setSaving(false);
      setError(upErr.message);
      return;
    }

    // Keep this session active; sign out every other device.
    await supabase.auth.signOut({ scope: "others" });
    setSaving(false);
    setDone(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: "#0D0B09" }}
    >
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-6"
          style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(30 8% 45%)", fontSize: "12px", letterSpacing: "0.06em" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div
          style={{
            background: "hsl(22 10% 8%)",
            border: "1px solid hsl(22 8% 15%)",
            borderRadius: "14px",
            padding: "2.25rem",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
          }}
        >
          <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 700, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            Security
          </p>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#F0EBE3", marginBottom: "0.4rem" }}>
            Change password
          </h1>
          <p style={{ fontSize: "12.5px", color: "hsl(30 8% 45%)", lineHeight: 1.7, marginBottom: "1.75rem" }}>
            Pick a strong password you don&apos;t use anywhere else. Changing it
            signs you out of every other device.
          </p>

          {done ? (
            <div
              style={{ background: "hsl(42 95% 55% / 0.08)", border: "1px solid hsl(42 95% 55% / 0.25)", borderRadius: "10px", padding: "1.25rem" }}
            >
              <p style={{ fontSize: "13px", color: "#E8DFD2", lineHeight: 1.7 }}>
                Your password has been updated and all other sessions have been
                signed out. You&apos;re still signed in here.
              </p>
              <button
                type="button"
                onClick={() => setDone(false)}
                style={{ marginTop: "0.75rem", color: "hsl(42 95% 60%)", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px" }}
              >
                Change it again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Hidden username field helps password managers associate the change. */}
              <input type="text" name="username" autoComplete="username" value={email ?? ""} readOnly hidden />

              <div className="space-y-1.5">
                <Label htmlFor="current" style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "hsl(30 8% 45%)" }}>
                  Current Password
                </Label>
                <Input
                  id="current"
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                  style={{ background: "hsl(20 12% 5%)", border: "1px solid hsl(22 8% 17%)", color: "#F0EBE3", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="next" style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "hsl(30 8% 45%)" }}>
                  New Password
                </Label>
                <Input
                  id="next"
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                  style={{ background: "hsl(20 12% 5%)", border: "1px solid hsl(22 8% 17%)", color: "#F0EBE3", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "hsl(30 8% 45%)" }}>
                  Confirm New Password
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
                disabled={saving || !email}
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
          )}
        </div>
      </div>
    </div>
  );
}
