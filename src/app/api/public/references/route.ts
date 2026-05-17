import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReferenceRequestByToken, submitReference } from "@/services/schools";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await getReferenceRequestByToken(supabase, token);

  if (error || !data) {
    return NextResponse.json(
      { error: "Reference request not found" },
      { status: 404 }
    );
  }

  const app = data.application_responses as any;
  const applicantName = app?.applicant_info
    ? [app.applicant_info.first_name, app.applicant_info.last_name].filter(Boolean).join(" ") || "the applicant"
    : "the applicant";

  return NextResponse.json({
    status: data.status,
    referee_name: data.referee_name,
    slot_label: (data.reference_slots as any)?.label ?? "Reference",
    slot_description: (data.reference_slots as any)?.description ?? null,
    applicant_name: applicantName,
    program_name: app?.programs?.name ?? "the program",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    token,
    relationship,
    known_duration,
    reference_text,
    form_data,
    answers,
  } = body;

  if (!token) {
    return NextResponse.json(
      { error: "token is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existing } = await getReferenceRequestByToken(supabase, token);
  if (!existing) {
    return NextResponse.json(
      { error: "Reference request not found" },
      { status: 404 }
    );
  }
  if (existing.status === "submitted") {
    return NextResponse.json(
      { error: "Reference has already been submitted" },
      { status: 409 }
    );
  }

  // Two payload shapes are accepted:
  //   - Legacy:  { relationship, known_duration, reference_text, form_data: {...flat keys} }
  //   - Current: { answers: [{question_id, question_label, answer}, ...] }
  // The dynamic referee form always sends the second; the first stays for any
  // unmigrated client. We persist current submissions as form_data.answers so
  // the admin display can render labels from the question snapshot.
  let payloadFormData: Record<string, unknown>;
  let payloadRelationship = relationship || "";
  let payloadKnownDuration = known_duration || "";
  let payloadReferenceText = reference_text || "";

  if (Array.isArray(answers) && answers.length > 0) {
    payloadFormData = { answers };

    // Best-effort fill of the legacy columns so admin lists / analytics that
    // still query them keep working until they're migrated.
    const findAnswerByLabel = (patterns: string[]) => {
      for (const pattern of patterns) {
        const match = (answers as Array<{ question_label: string; answer: string }>).find(
          (a) => a.question_label?.toLowerCase().includes(pattern) && a.answer?.trim()
        );
        if (match) return match.answer.trim();
      }
      return "";
    };
    if (!payloadRelationship) {
      payloadRelationship = findAnswerByLabel(["relationship"]);
    }
    if (!payloadKnownDuration) {
      payloadKnownDuration = findAnswerByLabel(["how long", "known the applicant"]);
    }
    if (!payloadReferenceText) {
      payloadReferenceText = findAnswerByLabel([
        "strengths and weaknesses",
        "strengths",
      ]);
    }
  } else {
    payloadFormData = form_data || {};
  }

  const { data, error } = await submitReference(supabase, token, {
    relationship: payloadRelationship,
    known_duration: payloadKnownDuration,
    reference_text: payloadReferenceText,
    form_data: payloadFormData,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, reference: data });
}
