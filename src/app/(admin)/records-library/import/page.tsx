import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { listTemplates } from "@/services/records-library";
import { ImportForm } from "./import-form";

export default async function RecordsLibraryImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "records-library");

  const templatesRes = await listTemplates(supabase);
  const templates = templatesRes.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Upload to Records Library</h1>
        <p className="text-sm text-gray-600 max-w-3xl">
          Upload a CSV, tell us what kind of record it represents, and map its
          columns to the core fields we track. Anything you don&apos;t map is
          preserved in each row&apos;s raw payload so nothing is lost.
        </p>
      </div>
      <ImportForm templates={templates} />
    </div>
  );
}
