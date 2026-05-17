import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

const STATUS_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "references_received", label: "References" },
  { key: "interview_scheduled", label: "Interview" },
  { key: "decision", label: "Decision" },
];

const STATUS_ORDER: Record<string, number> = {
  submitted: 0,
  waiting_for_references: 1,
  references_received: 1,
  interview_scheduled: 2,
  accepted: 3,
  rejected: 3,
  waitlisted: 3,
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    submitted: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
    waiting_for_references: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
    references_received: "bg-blue-900/40 text-blue-400 border-blue-700/50",
    interview_scheduled: "bg-purple-900/40 text-purple-400 border-purple-700/50",
    accepted: "bg-green-900/40 text-green-400 border-green-700/50",
    rejected: "bg-red-900/40 text-red-400 border-red-700/50",
    waitlisted: "bg-orange-900/40 text-orange-400 border-orange-700/50",
  };

  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${colors[status] ?? colors.submitted}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function ApplicationStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Look up the application by status_token
  const { data: response } = await supabase
    .from("application_responses")
    .select(
      "id, status, submitted_at, applicant_info, applicant_email, programs(name)"
    )
    .eq("status_token", token)
    .single();

  if (!response) {
    notFound();
  }

  // Fetch reference requests for this application
  const { data: refs } = await (supabase as any)
    .from("reference_requests")
    .select("id, status, referee_name")
    .eq("application_id", response.id);

  const totalRefs = refs?.length ?? 0;
  const submittedRefs =
    refs?.filter((r: { status: string }) => r.status === "submitted").length ??
    0;

  const currentStep = STATUS_ORDER[response.status] ?? 0;
  const programName =
    (response.programs as { name: string } | null)?.name ?? "Program";
  const firstName =
    (response.applicant_info as Record<string, string> | null)?.first_name ??
    "Applicant";

  return (
    <div className="min-h-screen bg-[#0D0B09] text-[#F0EBE3]">
      <div className="mx-auto max-w-lg px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-2xl font-black tracking-[0.06em] font-[Arial_Black,Arial,sans-serif]">
            FIRE & FRAGRANCE
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="inline-block w-5 h-px bg-[#F5C518]" />
            <span className="text-[9px] tracking-[0.3em] font-bold text-[#F5C518] uppercase">
              HUB
            </span>
            <span className="inline-block w-5 h-px bg-[#F5C518]" />
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-xl border border-[#2a2420] bg-[#141210] overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-transparent via-[#F5C518] to-transparent" />

          <div className="p-8 space-y-8">
            <div className="text-center space-y-2">
              <p className="text-[11px] tracking-[0.25em] font-bold text-[#F5C518] uppercase">
                Application Status
              </p>
              <h1 className="text-2xl font-black tracking-wide">
                Hi {firstName}
              </h1>
              <p className="text-sm text-[#B8A898]">
                Your application to{" "}
                <strong className="text-[#F0EBE3]">{programName}</strong>
              </p>
            </div>

            {/* Status Badge */}
            <div className="text-center">
              <StatusBadge status={response.status} />
            </div>

            {/* Progress Steps */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2">
                {STATUS_STEPS.map((step, idx) => {
                  const isActive = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                          isCurrent
                            ? "border-[#F5C518] bg-[#F5C518]/20 text-[#F5C518]"
                            : isActive
                              ? "border-[#F5C518] bg-[#F5C518] text-[#0D0B09]"
                              : "border-[#2a2420] bg-transparent text-[#5a4e42]"
                        }`}
                      >
                        {isActive && idx < currentStep ? "✓" : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase ${
                          isActive ? "text-[#F5C518]" : "text-[#5a4e42]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="mx-6 h-1 rounded-full bg-[#2a2420] mt-1">
                <div
                  className="h-full rounded-full bg-[#F5C518] transition-all"
                  style={{
                    width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-[#2a2420]">
                <span className="text-[#B8A898]">Submitted</span>
                <span>
                  {new Date(response.submitted_at).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              {totalRefs > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-[#2a2420]">
                  <span className="text-[#B8A898]">References</span>
                  <span
                    className={
                      submittedRefs === totalRefs
                        ? "text-green-400"
                        : "text-yellow-400"
                    }
                  >
                    {submittedRefs} of {totalRefs} received
                  </span>
                </div>
              )}
            </div>

            {/* Status-specific messaging */}
            {response.status === "accepted" && (
              <div className="rounded-lg bg-green-950/30 border border-green-800/30 p-4 text-center">
                <p className="text-green-400 font-semibold text-sm">
                  Congratulations! Your application has been accepted.
                </p>
                <p className="text-xs text-[#B8A898] mt-1">
                  Check your email for next steps and account setup instructions.
                </p>
              </div>
            )}

            {response.status === "rejected" && (
              <div className="rounded-lg bg-red-950/30 border border-red-800/30 p-4 text-center">
                <p className="text-red-400 font-semibold text-sm">
                  We appreciate your interest, but we are unable to offer a
                  place at this time.
                </p>
                <p className="text-xs text-[#B8A898] mt-1">
                  We wish you all the best in your future endeavours.
                </p>
              </div>
            )}

            {response.status === "waitlisted" && (
              <div className="rounded-lg bg-orange-950/30 border border-orange-800/30 p-4 text-center">
                <p className="text-orange-400 font-semibold text-sm">
                  You are on the waitlist for this program.
                </p>
                <p className="text-xs text-[#B8A898] mt-1">
                  We&apos;ll contact you if a spot becomes available.
                </p>
              </div>
            )}

            {response.status === "interview_scheduled" && (
              <div className="rounded-lg bg-purple-950/30 border border-purple-800/30 p-4 text-center">
                <p className="text-purple-400 font-semibold text-sm">
                  Your interview has been scheduled!
                </p>
                <p className="text-xs text-[#B8A898] mt-1">
                  Check your email for details about your upcoming interview.
                </p>
              </div>
            )}
          </div>

          <div className="h-px bg-[#2a2420]" />

          {/* Footer */}
          <div className="p-6 text-center">
            <p className="text-[10px] tracking-[0.25em] text-[#3a3028] uppercase font-bold">
              CATALYSE A GENERATION · EVANGELISE THE WORLD
            </p>
            <p className="text-[11px] text-[#3a3028] mt-1">
              Fire & Fragrance South Africa — ffsahub.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
