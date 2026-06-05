import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/services/events";
import { listTicketTypesByEvent } from "@/services/ticketing";
import { Storefront } from "./storefront";
import { TheSendStorefront } from "./the-send-storefront";
import { PublicFormNotice } from "@/components/public-form-shell";

// Bespoke landing pages keyed by the event's brand flag (migration 077).
// THE SEND gets its own bespoke storefront; everything else uses the
// standard Storefront. Both are intentionally event-bespoke and not
// migrated to the shared dark form shell. Legacy slug/title heuristic
// kept as a fallback so unmigrated rows still route correctly until
// every event row has its brand set explicitly.
function isTheSendBrand(event: {
  brand?: string | null;
  public_slug?: string | null;
  title?: string | null;
}): boolean {
  if (event.brand === "the_send") return true;
  if (event.brand && event.brand !== "the_send") return false;
  return (
    (event.public_slug ?? "").toLowerCase().includes("the-send") ||
    (event.title ?? "").toLowerCase().includes("the send")
  );
}

export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: event } = await getEventBySlug(supabase, slug);
  if (
    !event ||
    !event.ticketing_enabled ||
    event.status !== "published"
  ) {
    return (
      <PublicFormNotice
        eyebrow="Event"
        heading="Event not available"
        body="This event may have ended, been moved, or the link is incorrect."
      />
    );
  }

  const { data: ticketTypes } = await listTicketTypesByEvent(
    supabase,
    event.id,
    { onlyActive: true }
  );

  const eventProps = {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time,
    end_time: event.end_time,
    logo_url: event.logo_url ?? null,
  };

  if (isTheSendBrand(event)) {
    return (
      <TheSendStorefront event={eventProps} ticketTypes={ticketTypes ?? []} />
    );
  }

  return <Storefront event={eventProps} ticketTypes={ticketTypes ?? []} />;
}
