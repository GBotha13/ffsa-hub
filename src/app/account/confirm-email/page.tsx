"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Status = "checking" | "done" | "error";

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("This link is invalid or has expired.");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("This confirmation link is missing its token.");
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/account/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok) {
          setStatus("done");
          setEmail(typeof data.email === "string" ? data.email : "");
        } else {
          setStatus("error");
          setMessage(data.error ?? "This link is invalid or has expired.");
        }
      } catch {
        if (!active) return;
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: "#0D0B09" }}
    >
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: "2px", background: "linear-gradient(90deg, transparent, hsl(42 95% 55%), transparent)" }}
      />

      <div className="relative mb-12 text-center">
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
        className="relative w-full max-w-sm text-center"
        style={{
          background: "hsl(22 10% 8%)",
          border: "1px solid hsl(22 8% 15%)",
          borderRadius: "14px",
          padding: "2.25rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        {status === "checking" && (
          <p style={{ fontSize: "11px", letterSpacing: "0.2em", color: "hsl(30 8% 42%)", textTransform: "uppercase" }}>
            Confirming your email…
          </p>
        )}

        {status === "done" && (
          <>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "1rem" }}>
              Email updated
            </p>
            <p style={{ fontSize: "13px", color: "#C9C0B5", lineHeight: 1.7 }}>
              Your sign-in email is now{" "}
              <span style={{ color: "#F0EBE3" }}>{email || "updated"}</span>. Use it
              next time you sign in.
            </p>
            <Link href="/login">
              <span
                style={{ display: "inline-block", marginTop: "1.5rem", fontSize: "11px", letterSpacing: "0.08em", color: "hsl(42 95% 60%)", textDecoration: "none" }}
              >
                Continue to sign in →
              </span>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", fontWeight: 600, color: "hsl(0 60% 60%)", textTransform: "uppercase", marginBottom: "1rem" }}>
              Link problem
            </p>
            <p style={{ fontSize: "13px", color: "#C9C0B5", lineHeight: 1.7 }}>{message}</p>
            <Link href="/account/security">
              <span
                style={{ display: "inline-block", marginTop: "1.5rem", fontSize: "11px", letterSpacing: "0.08em", color: "hsl(42 95% 60%)", textDecoration: "none" }}
              >
                Back to account security →
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
