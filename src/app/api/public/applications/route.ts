import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProgramPublicInfo,
  getQuestionsByProgram,
  getResponseByEmailAndProgram,
  createPublicResponse,
  getReferenceSlotsByProgram,
  createReferenceRequest,
} from "@/services/schools";
import { Resend } from "resend";
import { applicationConfirmationEmailHtml } from "@/lib/email/templates/application-confirmation";
import { referenceRequestEmailHtml } from "@/lib/email/templates/reference-request";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const body = await request.json();
  const { program_id, applicant_info, answers, references, files } = body;

  if (!program_id || !applicant_info || !answers) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const { first_name, last_name, email } = applicant_info;

  if (!first_name || !last_name || !email) {
    return NextResponse.json(
      { error: "First name, last name, and email are required" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Please provide a valid email address" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify program exists, is active, and open for applications
  const { data: program } = await getProgramPublicInfo(supabase, program_id);

  if (!program || program.status !== "active" || !program.application_open) {
    return NextResponse.json(
      { error: "This program is not currently accepting applications" },
      { status: 400 }
    );
  }

  // Check for duplicate: same email already applied to this program
  const { data: existing } = await getResponseByEmailAndProgram(
    supabase,
    email,
    program_id
  );

  if (existing) {
    return NextResponse.json(
      { error: "An application with this email has already been submitted for this program" },
      { status: 409 }
    );
  }

  // Also check if an authenticated user with this email already applied
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    const { data: existingUserResponse } = await supabase
      .from("application_responses")
      .select("id")
      .eq("user_id", existingUser.id)
      .eq("program_id", program_id)
      .maybeSingle();

    if (existingUserResponse) {
      return NextResponse.json(
        { error: "An application with this email has already been submitted for this program" },
        { status: 409 }
      );
    }
  }

  // Validate required questions
  const { data: questions } = await getQuestionsByProgram(supabase, program_id);
  const requiredIds = new Set(
    (questions ?? []).filter((q: { is_required: boolean }) => q.is_required).map((q: { id: string }) => q.id)
  );

  for (const a of answers) {
    if (requiredIds.has(a.question_id) && !a.answer?.trim()) {
      return NextResponse.json(
        { error: `Please answer the required question: "${a.question_label}"` },
        { status: 400 }
      );
    }
  }

  // Insert the application
  const enrichedInfo = files && Array.isArray(files) && files.length > 0
    ? { ...applicant_info, files }
    : applicant_info;

  const { data: response, error: insertError } = await createPublicResponse(
    supabase,
    {
      program_id,
      applicant_email: email,
      applicant_info: enrichedInfo,
      answers,
    }
  );

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to submit application. Please try again." },
      { status: 500 }
    );
  }

  // Send confirmation email
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ffsahub.com";
  await resend.emails.send({
    from: `Fire & Fragrance SA <${fromEmail}>`,
    to: email,
    subject: `Application Received — ${program.name}`,
    html: applicationConfirmationEmailHtml({
      firstName: first_name,
      programName: program.name,
    }),
  });

  // Create reference requests and send emails to referees
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ffsahub.com";
  const referenceLinks: Array<{ label: string; url: string }> = [];

  if (references && Array.isArray(references) && references.length > 0) {
    const { data: slots } = await getReferenceSlotsByProgram(supabase, program_id);
    const slotMap = new Map<string, any>((slots ?? []).map((s: any) => [s.id, s]));

    for (const ref of references) {
      if (!ref.slot_id || !ref.referee_name || !ref.referee_email) continue;

      const { data: refRequest } = await createReferenceRequest(supabase, {
        application_id: response.id,
        slot_id: ref.slot_id,
        referee_name: ref.referee_name,
        referee_email: ref.referee_email,
      });

      if (refRequest) {
        const slot = slotMap.get(ref.slot_id);
        const referenceUrl = `${siteUrl}/reference/${refRequest.token}`;

        referenceLinks.push({
          label: slot?.label ?? "Reference",
          url: referenceUrl,
        });

        await resend.emails.send({
          from: `Fire & Fragrance SA <${fromEmail}>`,
          to: ref.referee_email,
          subject: `Reference Request — ${program.name}`,
          html: referenceRequestEmailHtml({
            refereeName: ref.referee_name,
            applicantName: `${first_name} ${last_name}`,
            programName: program.name,
            slotLabel: slot?.label ?? "Reference",
            referenceUrl,
          }),
        });

        await (supabase as any)
          .from("reference_requests")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", refRequest.id);
      }
    }
  }

  return NextResponse.json({ success: true, id: response.id, referenceLinks });
}
