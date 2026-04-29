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
          <p className="page-eyebrow">TRAINING &amp; EDUCATION</p>
          <h1 className="page-title">Schools</h1>
        </div>
        <CreateProgramForm />
      </div>

      <ProgramsTable programs={programs ?? []} />
    </div>
  );
}
