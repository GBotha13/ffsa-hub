import { createAdminClient } from "@/lib/supabase/admin";
import {
  getReferenceRequestByToken,
  getReferenceQuestionsByProgram,
} from "@/services/schools";
import { ReferenceForm } from "./reference-form";

export default async function ReferencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: refRequest, error } = await getReferenceRequestByToken(
    supabase,
    token
  );

  if (error || !refRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0D0B09" }}>
        <div className="text-center max-w-md">
          <h1 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", color: "#F0EBE3", letterSpacing: "0.04em" }}>
            Invalid Link
          </h1>
          <p className="text-sm mt-2" style={{ color: "#B8A898" }}>
            This reference link is invalid or has expired. Please contact the applicant for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (refRequest.status === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0D0B09" }}>
        <div className="text-center max-w-md">
          <h1 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", color: "#F0EBE3", letterSpacing: "0.04em" }}>
            Reference Already Submitted
          </h1>
          <p className="text-sm mt-2" style={{ color: "#B8A898" }}>
            Thank you! Your reference has already been submitted. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  const app = refRequest.application_responses as any;
  const slot = refRequest.reference_slots as any;

  const applicantName = app?.applicant_info
    ? [app.applicant_info.first_name, app.applicant_info.last_name].filter(Boolean).join(" ") || "the applicant"
    : "the applicant";

  const programName = app?.programs?.name ?? "the program";

  const { data: referenceQuestions } = app?.program_id
    ? await getReferenceQuestionsByProgram(supabase, app.program_id)
    : { data: [] };

  return (
    <ReferenceForm
      token={token}
      refereeName={refRequest.referee_name}
      applicantName={applicantName}
      programName={programName}
      slotLabel={slot?.label ?? "Reference"}
      slotDescription={slot?.description ?? null}
      questions={referenceQuestions ?? []}
    />
  );
}
