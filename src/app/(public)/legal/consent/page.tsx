import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentConsentAgreement } from "@/services/consent";
import { Markdown } from "@/components/markdown";
import {
  PublicFormShell,
  PublicFormNotice,
  PUBLIC_SHELL_TOKENS,
} from "@/components/public-form-shell";

const T = PUBLIC_SHELL_TOKENS;

export const dynamic = "force-dynamic";

export default async function ConsentAgreementPage() {
  const supabase = createAdminClient();
  const { data: agreement } = await getCurrentConsentAgreement(supabase);

  if (!agreement) {
    return (
      <PublicFormNotice
        eyebrow="Privacy"
        heading="Agreement unavailable"
        body="The privacy agreement is currently unavailable. Please contact info@fireandfragrance.com."
      />
    );
  }

  return (
    <PublicFormShell
      eyebrow="Privacy & Data Processing"
      heading="Consent agreement"
      maxWidth={760}
    >
      <div
        className="prose prose-invert max-w-none"
        style={{ color: T.textDim }}
      >
        <Markdown source={agreement.body_markdown} />
      </div>
      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: T.textDimmer,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        Agreement version: {agreement.version}
      </p>
    </PublicFormShell>
  );
}
