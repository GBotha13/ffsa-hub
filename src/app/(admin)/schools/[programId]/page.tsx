import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProgramById, getEnrollmentsByProgram, getGradesByProgram, getQuestionsByProgram, getResponsesByProgram } from "@/services/schools";
import { ProgramDetail } from "./program-detail";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const supabase = await createClient();

  const { data: program, error: programError } = await getProgramById(supabase, programId);

  if (programError || !program) {
    return (
      <div className="space-y-4">
        <Link href="/schools" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Schools
        </Link>
        <p className="text-destructive">Program not found.</p>
      </div>
    );
  }

  const { data: enrollments } = await getEnrollmentsByProgram(supabase, programId);
  const { data: grades } = await getGradesByProgram(supabase, programId);

  const { data: questions } = await getQuestionsByProgram(supabase, programId);
  const { data: responses } = await getResponsesByProgram(supabase, programId);

  // Fetch all users for the enrollment selector
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, first_name, last_name, preferred_name, email")
    .eq("is_active", true)
    .order("last_name", { ascending: true });

  return (
    <div className="space-y-6">
      <Link href="/schools" className="text-sm text-muted-foreground hover:underline">
        &larr; Back to Schools
      </Link>

      <ProgramDetail
        program={program}
        enrollments={enrollments ?? []}
        grades={grades ?? []}
        allUsers={allUsers ?? []}
        questions={questions ?? []}
        responses={responses ?? []}
      />
    </div>
  );
}
