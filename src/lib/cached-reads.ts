// Cached reads for organisation-wide enums that change rarely (labels, person
// types). Wrapping these in unstable_cache cuts ~3-5 redundant Supabase
// round-trips per admin page render — the biggest concurrency win once 10+
// people are working in the app at once.
//
// The cache function runs OUTSIDE request scope, so it can't use the
// request-scoped Supabase client (cookies/auth). We use the service-role
// admin client here, which is safe because these tables hold no per-user
// data: labels and person types are global metadata everyone can read.
//
// Tags allow targeted busting from mutation sites — call revalidateTag("labels")
// after a label is created/updated/deactivated to make changes appear
// immediately instead of waiting for the revalidate window to close.

import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLabels } from "@/services/labels";
import { getPersonTypes } from "@/services/contacts";

// Call these from server actions / API routes that mutate the cached tables,
// so the next read returns fresh data immediately instead of waiting for the
// revalidate window to close. Cheap (just busts cache entries by tag).
export function revalidateLabelsCache() {
  revalidateTag("labels");
}

export function revalidatePersonTypesCache() {
  revalidateTag("person_types");
}

export const getCachedActiveLabels = unstable_cache(
  async () => {
    const admin = createAdminClient();
    return getLabels(admin, { active: true });
  },
  ["active-labels"],
  { revalidate: 300, tags: ["labels"] }
);

export const getCachedPersonTypes = unstable_cache(
  async () => {
    const admin = createAdminClient();
    return getPersonTypes(admin);
  },
  ["person-types"],
  { revalidate: 600, tags: ["person_types"] }
);
