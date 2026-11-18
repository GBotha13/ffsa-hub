import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInSA } from "@/lib/legal/status";
import {
  getLegalAccessList,
  getLegalApplications,
  getLegalDocumentTypes,
  getLegalDocuments,
  getLegalFiles,
  getLegalFolders,
  hasLegalAccess,
} from "@/services/legal-documents";
import { DocumentsView } from "./documents-view";
import type { AppRow, DocRow, FileRow, FolderRow, Person, TypeRow } from "./legal-ui";

export const dynamic = "force-dynamic";

// Legal → Documents. Plan: docs/legal-documents.md.
//
// The gate is the legal_access list (migration 371), not a role: every
// read below runs as the user, so RLS decides what comes back. The only
// service-role read is the names of the people on that list, for the
// "Responsible" picker.
export default async function LegalDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: allowed } = await hasLegalAccess(supabase);
  if (allowed !== true) redirect("/dashboard");

  const [folders, types, documents, files, applications, access] = await Promise.all([
    getLegalFolders(supabase, { includeArchived: true }),
    getLegalDocumentTypes(supabase),
    getLegalDocuments(supabase),
    getLegalFiles(supabase),
    getLegalApplications(supabase),
    getLegalAccessList(supabase),
  ]);
  const failed = [folders, types, documents, files, applications].find((r) => r.error);
  if (failed) throw new Error(`Could not load documents: ${failed.error.message}`);

  // Names for the people on the access list only.
  const memberIds: string[] = Array.from(
    new Set(((access.data ?? []) as Array<{ user_id: string }>).map((a) => a.user_id))
  );
  let people: Person[] = [];
  if (memberIds.length) {
    const admin = createAdminClient();
    const { data } = await admin.from("users").select("id, first_name, last_name").in("id", memberIds);
    people = (data ?? [])
      .map((u) => ({ id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "Unnamed" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const apps: AppRow[] = ((applications.data ?? []) as Array<AppRow & { legal_application_steps: AppRow["steps"] }>).map(
    ({ legal_application_steps, ...a }) => ({ ...a, steps: legal_application_steps ?? [] })
  );

  return (
    <DocumentsView
      folders={(folders.data ?? []) as FolderRow[]}
      types={(types.data ?? []) as TypeRow[]}
      documents={(documents.data ?? []) as DocRow[]}
      files={(files.data ?? []) as FileRow[]}
      applications={apps}
      people={people}
      today={todayInSA()}
    />
  );
}
