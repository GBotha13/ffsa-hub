import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentConsentAgreement } from "@/services/consent";
import { Markdown } from "@/components/markdown";

export const dynamic = "force-dynamic";

export default async function ConsentAgreementPage() {
  const supabase = createAdminClient();
  const { data: agreement } = await getCurrentConsentAgreement(supabase);

  if (!agreement) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h1 className="text-xl font-bold text-foreground">Agreement Unavailable</h1>
        <p className="text-sm text-muted-foreground">
          The privacy agreement is currently unavailable. Please contact{" "}
          <a href="mailto:info@fireandfragrance.com" className="underline">
            info@fireandfragrance.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-8">
      <div className="text-center space-y-2">
        <div className="text-2xl font-black tracking-wide text-foreground">
          FIRE & FRAGRANCE
        </div>
        <div className="text-xs font-bold tracking-[0.3em] text-primary uppercase">
          HUB
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <Markdown source={agreement.body_markdown} />
        <p className="mt-6 text-xs text-muted-foreground">
          Agreement version: <span className="font-mono">{agreement.version}</span>
        </p>
      </div>
    </div>
  );
}
