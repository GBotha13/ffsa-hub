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
  const { token, relationship, known_duration, reference_text, form_data } = body;

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

  const { data, error } = await submitReference(supabase, token, {
    relationship: relationship || "",
    known_duration: known_duration || "",
    reference_text: reference_text || "",
    form_data: form_data || {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, reference: data });
}
