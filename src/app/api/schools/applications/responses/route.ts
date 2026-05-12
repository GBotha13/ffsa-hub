import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createResponse,
  updateResponseStatus,
  getReferenceSlotsByProgram,
  createReferenceRequest,
} from "@/services/schools";
import { Resend } from "resend";
import { referenceRequestEmailHtml } from "@/lib/email/templates/reference-request";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { program_id, answers, references } = body;

  if (!program_id || !answers || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "program_id and answers array are required" },
      { status: 400 }
    );
  }

  const { data, error } = await createResponse(supabase, {
    program_id,
    user_id: user.id,
    answers,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already submitted an application for this program" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create reference requests and send emails
  if (references && Array.isArray(references) && references.length > 0) {
    const adminSupabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ffsahub.com";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ffsahub.com";

    const { data: slots } = await getReferenceSlotsByProgram(supabase, program_id);
    const slotMap = new Map<string, any>((slots ?? []).map((s: any) => [s.id, s]));

    const { data: appUser } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const { data: program } = await supabase
      .from("programs")
      .select("name")
      .eq("id", program_id)
      .single();

    const applicantName = appUser
      ? `${appUser.first_name ?? ""} ${appUser.last_name ?? ""}`.trim()
      : "the applicant";

    for (const ref of references) {
      if (!ref.slot_id || !ref.referee_name || !ref.referee_email) continue;

      const { data: refRequest } = await createReferenceRequest(adminSupabase, {
        application_id: data.id,
        slot_id: ref.slot_id,
        referee_name: ref.referee_name,
        referee_email: ref.referee_email,
      });

      if (refRequest) {
        const slot = slotMap.get(ref.slot_id);
        const referenceUrl = `${siteUrl}/reference/${refRequest.token}`;

        await resend.emails.send({
          from: `Fire & Fragrance SA <${fromEmail}>`,
          to: ref.referee_email,
          subject: `Reference Request — ${program?.name ?? "School Program"}`,
          html: referenceRequestEmailHtml({
            refereeName: ref.referee_name,
            applicantName,
            programName: program?.name ?? "School Program",
            slotLabel: slot?.label ?? "Reference",
            referenceUrl,
          }),
        });

        await (adminSupabase as any)
          .from("reference_requests")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", refRequest.id);
      }
    }
  }

  return NextResponse.json({ success: true, response: data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  const { data, error } = await updateResponseStatus(supabase, id, status, user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, response: data });
}
