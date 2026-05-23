import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACCENT = "#1d4ed8";

export default async function ThanksPage({
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;

  let order: {
    status: string;
    buyer_email: string;
  } | null = null;
  if (orderId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("status, buyer_email")
      .eq("id", orderId)
      .maybeSingle();
    order = data ?? null;
  }

  const status = order?.status ?? null;
  const buyerEmail = order?.buyer_email ?? null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflowY: "auto",
        background: "linear-gradient(180deg,#f8fafc 0%,#eef1f5 100%)",
        colorScheme: "light",
      }}
    >
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-[560px] rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#ffffff",
            color: "#0f172a",
            boxShadow:
              "0 1px 2px rgba(15,23,42,.04), 0 12px 32px -12px rgba(15,23,42,.18)",
            border: "1px solid #eef1f5",
          }}
        >
          <div style={{ height: 5, backgroundColor: ACCENT }} />
          <div className="px-7 sm:px-9 pt-10 pb-10 text-center">
            <div
              className="mx-auto mb-6 flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, backgroundColor: `${ACCENT}14` }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            {status === "paid" ? (
              <>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "#0f172a" }}
                >
                  Thanks — your tickets are on their way
                </h1>
                <p className="text-sm mt-3" style={{ color: "#475569" }}>
                  We've emailed your tickets (with QR codes for the door) to{" "}
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                    {buyerEmail}
                  </span>
                  .
                </p>
                <p className="text-xs mt-3" style={{ color: "#94a3b8" }}>
                  Can't see it? Check your spam folder, or reply to the email to
                  reach us.
                </p>
              </>
            ) : status === "pending" ? (
              <>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "#0f172a" }}
                >
                  Payment is processing
                </h1>
                <p className="text-sm mt-3" style={{ color: "#475569" }}>
                  We're confirming with PayFast. Your tickets will arrive in your
                  inbox shortly.
                </p>
              </>
            ) : (
              <>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "#0f172a" }}
                >
                  Thanks!
                </h1>
                <p className="text-sm mt-3" style={{ color: "#475569" }}>
                  If you completed payment, your tickets will arrive by email
                  shortly.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
