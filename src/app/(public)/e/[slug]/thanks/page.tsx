import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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
    <div className="w-full animate-fade-up">
      <Card>
        <CardContent className="p-8 sm:p-12 text-center space-y-3">
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              backgroundColor: "var(--yellow-dim)",
              border: "1px solid var(--yellow-border)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--yellow)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          {status === "paid" ? (
            <>
              <p className="page-eyebrow">Confirmed</p>
              <h1 className="page-title">Your tickets are on their way</h1>
              <p className="text-sm text-foreground/80 normal-case tracking-normal pt-2">
                We've emailed your tickets (with QR codes for the door) to{" "}
                <span className="font-semibold text-foreground">
                  {buyerEmail}
                </span>
                .
              </p>
              <p className="text-xs text-muted-foreground normal-case tracking-normal pt-2">
                Can't see it? Check your spam folder, or reply to the email to
                reach us.
              </p>
            </>
          ) : status === "pending" ? (
            <>
              <p className="page-eyebrow">Processing</p>
              <h1 className="page-title">Payment is processing</h1>
              <p className="text-sm text-foreground/80 normal-case tracking-normal pt-2">
                We're confirming with PayFast. Your tickets will arrive in your
                inbox shortly.
              </p>
            </>
          ) : (
            <>
              <p className="page-eyebrow">Thanks</p>
              <h1 className="page-title">Thanks!</h1>
              <p className="text-sm text-foreground/80 normal-case tracking-normal pt-2">
                If you completed payment, your tickets will arrive by email
                shortly.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
