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

function findAnswerByType(
  answers: Array<{ question_id: string; question_label: string; answer: string }>,
  questions: Array<{ id: string; type: string; label: string }>,
  type: string
): string | null {
  const questionIds = new Set(questions.filter((q) => q.type === type).map((q) => q.id));
  const match = answers.find((a) => questionIds.has(a.question_id) && a.answer?.trim());
  return match?.answer?.trim() || null;
}

function findAnswerByLabel(
  answers: Array<{ question_id: string; question_label: string; answer: string }>,
  patterns: string[]
): string | null {
  for (const pattern of patterns) {
    const match = answers.find(
      (a) => a.question_label.toLowerCase().includes(pattern) && a.answer?.trim()
    );
    if (match) return match.answer.trim();
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { program_id, answers, references, files } = body;

  if (!program_id || !answers) {
    return NextResponse.json(
      { error: "Missing required fields" },
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

  // Try to extract email from answers (look for email-type question first, then label match)
  const email = findAnswerByType(answers, questions ?? [], "email")
    ?? findAnswerByLabel(answers, ["email"]);

  // Try to extract name from answers
  const firstName = findAnswerByLabel(answers, ["first name", "first_name"])
    ?? findAnswerByLabel(answers, ["name"]);
  const lastName = findAnswerByLabel(answers, ["last name", "last_name", "surname"]);

  // Check for duplicate if we have an email
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

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
  }

  // Build applicant_info from answers
  const applicantInfo: Record<string, unknown> = {};
  if (email) applicantInfo.email = email;
  if (firstName) applicantInfo.first_name = firstName;
  if (lastName) applicantInfo.last_name = lastName;
  if (files && Array.isArray(files) && files.length > 0) {
    applicantInfo.files = files;
  }

  const { data: response, error: insertError } = await createPublicResponse(
    supabase,
    {
      program_id,
      applicant_email: email || "unknown@applicant.local",
      applicant_info: applicantInfo,
      answers,
    }
  );

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to submit application. Please try again." },
      { status: 500 }
    );
  }

  // Send confirmation email if we have one
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ffsahub.com";
  if (email) {
    await resend.emails.send({
      from: `Fire & Fragrance SA <${fromEmail}>`,
      to: email,
      subject: `Application Received — ${program.name}`,
      html: applicationConfirmationEmailHtml({
        firstName: firstName || "Applicant",
        programName: program.name,
      }),
    });
  }

  // Create reference requests and send emails to referees
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ffsahub.com";
  const referenceLinks: Array<{ label: string; url: string }> = [];

  if (references && Array.isArray(references) && references.length > 0) {
    const { data: slots } = await getReferenceSlotsByProgram(supabase, program_id);
    const slotMap = new Map<string, any>((slots ?? []).map((s: any) => [s.id, s]));
    const applicantName = [firstName, lastName].filter(Boolean).join(" ") || "An applicant";

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
            applicantName,
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
