import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { getPossibleDuplicates } from "@/services/possible-duplicates";
import { ContactsTabsNav } from "../contacts-tabs-nav";
import { DuplicatesList } from "./duplicates-list";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "contacts");

  // Service-role client: the scan reads across all contacts + identifiers.
  const admin = createAdminClient();
  const clusters = await getPossibleDuplicates(admin);

  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">PEOPLE &amp; RELATIONSHIPS</p>
        <h1 className="page-title">Contacts</h1>
      </div>

      <ContactsTabsNav followupPendingCount={null} />

      <div>
        <h2 className="text-lg font-semibold">Possible duplicates</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Separate contacts that look like the same person — grouped when they
          share a name or a phone number across different emails. Pick which
          record to keep and merge the rest into it; all emails, phones, labels,
          activity, form submissions and workflow history move to the contact
          you keep.
        </p>
      </div>

      <DuplicatesList clusters={clusters} />
    </div>
  );
}
