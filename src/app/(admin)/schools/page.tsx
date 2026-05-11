import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { getPrograms } from "@/services/schools";
import { ProgramsTable } from "./programs-table";
import { CreateProgramForm } from "./create-program-form";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "schools");

  const params = await searchParams;
  const statusFilter = params.status || "active";

  const { data: programs, error } = await getPrograms(supabase, {
    status: statusFilter,
  });

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

      <ProgramsTable programs={programs ?? []} statusFilter={statusFilter} />
    </div>
  );
}
