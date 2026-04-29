import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { getContacts } from "@/services/contacts";
import { getPersonTypes } from "@/services/contacts";
import { ContactsList } from "./contacts-list";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "contacts");

  const status = params.status ?? "active";
  const search = params.search;
  const page = parseInt(params.page ?? "1", 10);
  const pageSize = 25;

  const { data: contacts, count } = await getContacts(supabase, {
    status,
    search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const { data: personTypes } = await getPersonTypes(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">PEOPLE &amp; RELATIONSHIPS</p>
        <h1 className="page-title">Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">{count ?? 0} contacts</p>
      </div>

      <ContactsList
        contacts={contacts ?? []}
        personTypes={personTypes ?? []}
        totalCount={count ?? 0}
        currentPage={page}
        pageSize={pageSize}
        searchQuery={search}
        statusFilter={status}
      />
    </div>
  );
}
