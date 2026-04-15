import { createClient } from "@/lib/supabase/server";
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
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          {count ?? 0} contacts
        </p>
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
