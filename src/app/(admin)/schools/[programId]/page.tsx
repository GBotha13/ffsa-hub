import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProgramById, getEnrollmentsByProgram, getGradesByProgram, getQuestionsByProgram, getResponsesByProgram, getReferenceSlotsByProgram, getReferenceRequestSummaries, getReferenceQuestionsByProgram } from "@/services/schools";
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
  const { data: referenceSlots } = await getReferenceSlotsByProgram(supabase, programId);
  const { data: referenceQuestions } = await getReferenceQuestionsByProgram(supabase, programId);

  const applicationIds = (responses ?? []).map((r: any) => r.id);
  const { data: refRequests } = await getReferenceRequestSummaries(supabase, applicationIds);

  // Fetch all users for the enrollment selector
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, first_name, last_name, preferred_name, email")
    .eq("is_active", true)
    .order("last_name", { ascending: true });

  // Fetch staff pool (anyone with staff/program_leader/admin/super_admin role)
  // to populate the point-of-contact pickers.
  const { data: staffRoleRows } = await supabase
    .from("user_roles")
    .select("user_id, roles!inner(name), users!inner(id, first_name, last_name, preferred_name, email, is_active)")
    .in("roles.name", ["super_admin", "admin", "program_leader", "staff"]);

  const staffMap = new Map<
    string,
    { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null; email: string | null }
  >();
  for (const row of (staffRoleRows ?? []) as Array<{
    users: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      email: string | null;
      is_active: boolean | null;
    } | null;
  }>) {
    const u = row.users;
    if (!u || u.is_active === false) continue;
    if (!staffMap.has(u.id)) {
      staffMap.set(u.id, {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        preferred_name: u.preferred_name,
        email: u.email,
      });
    }
  }
  const staffOptions = Array.from(staffMap.values()).sort((a, b) =>
    `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`)
  );

  return (
    <div className="space-y-6">
      <ProgramDetail
        program={program}
        enrollments={enrollments ?? []}
        grades={grades ?? []}
        allUsers={allUsers ?? []}
        staffOptions={staffOptions}
        questions={questions ?? []}
        responses={responses ?? []}
        referenceSlots={referenceSlots ?? []}
        referenceQuestions={referenceQuestions ?? []}
        refRequestSummaries={refRequests ?? []}
      />
    </div>
  );
}
