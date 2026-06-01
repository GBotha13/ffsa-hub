import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import {
  getAccessibleEventIdsForFollowups,
  userCanAccessFollowupQueue,
} from "@/lib/auth/check-followup-access";
import {
  fetchAssignableFollowupHandlers,
  type AssignableFollowupHandler,
} from "@/lib/auth/assignable-followup-handlers";
import { getFollowupQueue } from "@/services/event-followup";
import { ContactsTabsNav } from "../contacts-tabs-nav";
import { FollowupQueue } from "./followup-queue";

export default async function EventFollowupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "contacts");

  // Has the user been given any access to this surface?
  const canAccess = await userCanAccessFollowupQueue(supabase, user.id);
  if (!canAccess) redirect("/contacts");

  const accessibleEventIds = await getAccessibleEventIdsForFollowups(
    supabase,
    user.id
  );

  const queue = await getFollowupQueue(supabase, { accessibleEventIds });

  // Map of event_id → assignable handlers for that event. Built once
  // for every event present in the queue so the drawer dropdowns are
  // populated without per-row fetching.
  const adminSupabase = createAdminClient();
  const uniqueEventIds = Array.from(new Set(queue.map((r) => r.event.id)));
  const handlersByEvent: Record<string, AssignableFollowupHandler[]> = {};
  await Promise.all(
    uniqueEventIds.map(async (eventId) => {
      handlersByEvent[eventId] = await fetchAssignableFollowupHandlers(
        adminSupabase,
        eventId
      );
    })
  );

  const pendingCount = queue.filter(
    (r) => !r.assigned_staff_id || r.is_unread
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">PEOPLE &amp; RELATIONSHIPS</p>
          <h1 className="page-title">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {queue.length} active follow-up{queue.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <ContactsTabsNav followupPendingCount={pendingCount} />

      <FollowupQueue
        queue={queue}
        handlersByEvent={handlersByEvent}
        currentUserId={user.id}
      />
    </div>
  );
}
