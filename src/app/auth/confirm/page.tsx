"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function handleConfirm() {
      // --- PKCE flow: ?code=xxx in query string ---
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        router.replace("/login?error=invite_expired");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace("/login?error=invite_expired");
          return;
        }
        router.replace("/onboarding");
        return;
      }

      // --- Implicit / hash flow: #access_token=xxx in fragment ---
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");
        const tokenHash = params.get("token_hash");

        // OTP token_hash flow
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) {
            router.replace("/login?error=invite_expired");
            return;
          }
          router.replace("/onboarding");
          return;
        }

        // Access token in hash (implicit flow)
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            router.replace("/login?error=invite_expired");
            return;
          }
          // For invite type, send to onboarding; otherwise dashboard
          if (type === "invite" || type === "signup") {
            router.replace("/onboarding");
          } else {
            router.replace("/dashboard");
          }
          return;
        }
      }

      // Nothing matched
      router.replace("/login?error=invalid_link");
    }

    handleConfirm();
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#0D0B09" }}
    >
      <div className="text-center">
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "hsl(30 8% 42%)",
            textTransform: "uppercase",
          }}
        >
          Verifying your invite…
        </p>
      </div>
    </div>
  );
}
