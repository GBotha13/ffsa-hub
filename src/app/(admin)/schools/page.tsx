import { createClient } from "@/lib/supabase/server";
import { getPrograms } from "@/services/schools";
import { ProgramsTable } from "./programs-table";
import { CreateProgramForm } from "./create-program-form";

export default async function SchoolsPage() {
  const supabase = await createClient();
  const { data: programs, error } = await getPrograms(supabase);

  if (error) {
    console.error("getPrograms error:", JSON.stringify(error, null, 2));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schools</h1>
          <p className="text-sm text-muted-foreground">
            Manage programs, courses, enrollments, and grades
          </p>
        </div>
        <CreateProgramForm />
      </div>

      <ProgramsTable programs={programs ?? []} />
    </div>
  );
}
