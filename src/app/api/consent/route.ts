import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentConsentAgreement, recordConsent } from "@/services/consent";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await getCurrentConsentAgreement(supabase);
  if (error || !data) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }
  return NextResponse.json({ agreement: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { agreement_version, source } = body;

  if (!source || (source !== "onboarding" && source !== "application")) {
    return NextResponse.json(
      { error: "Invalid source" },
      { status: 400 }
    );
  }

  // Validate version matches the current published agreement.
  const { data: current } = await getCurrentConsentAgreement(supabase);
  if (!current) {
    return NextResponse.json(
      { error: "Consent agreement is not configured" },
      { status: 500 }
    );
  }
  if (!agreement_version || agreement_version !== current.version) {
    return NextResponse.json(
      { error: "Agreement version mismatch. Please reload the page." },
      { status: 400 }
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const userAgent = request.headers.get("user-agent");

  const { error } = await recordConsent(supabase, {
    agreement_version,
    source,
    user_id: user.id,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, version: agreement_version });
}
