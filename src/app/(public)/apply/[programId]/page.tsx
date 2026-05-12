import { createAdminClient } from "@/lib/supabase/admin";
import { getProgramPublicInfo, getQuestionsByProgram, getReferenceSlotsByProgram } from "@/services/schools";
import { PublicApplicationForm } from "./public-application-form";

export default async function PublicApplyPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const supabase = createAdminClient();

  const { data: program } = await getProgramPublicInfo(supabase, programId);

  if (!program || program.status !== "active" || !program.application_open) {
    return (
      <div className="text-center space-y-4 py-16">
        <div className="space-y-2">
          <div className="text-2xl font-black tracking-wide text-foreground">
            FIRE & FRAGRANCE
          </div>
          <div className="text-xs font-bold tracking-[0.3em] text-primary uppercase">
            HUB
          </div>
        </div>
        <div className="pt-8">
          <h1 className="text-xl font-bold text-foreground">
            Applications Closed
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {program
              ? `Applications for ${program.name} are currently closed. Please check back later.`
              : "This program was not found or is no longer available."}
          </p>
        </div>
      </div>
    );
  }

  const { data: questions } = await getQuestionsByProgram(supabase, programId);
  const { data: referenceSlots } = await getReferenceSlotsByProgram(supabase, programId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-2xl font-black tracking-wide text-foreground">
          FIRE & FRAGRANCE
        </div>
        <div className="text-xs font-bold tracking-[0.3em] text-primary uppercase">
          HUB
        </div>
      </div>

      {/* Program Info */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Apply to {program.name}
        </h1>
        {program.description && (
          <p className="text-sm text-muted-foreground">{program.description}</p>
        )}
      </div>

      {/* Form */}
      <PublicApplicationForm
        programId={programId}
        programName={program.name}
        questions={questions ?? []}
        referenceSlots={referenceSlots ?? []}
      />
    </div>
  );
}
