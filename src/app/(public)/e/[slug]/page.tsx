import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/services/events";
import { listTicketTypesByEvent } from "@/services/ticketing";
import { Storefront } from "./storefront";
import { TheSendStorefront } from "./the-send-storefront";
import { CampsStorefront } from "./camps-storefront";
import { PublicFormNotice } from "@/components/public-form-shell";

type EventBrand = "ff" | "the_send" | "ffsa_camps";

// Bespoke landing pages keyed by the event's brand flag (migration 077 +
// the ffsa_camps follow-up). THE SEND and FFSA Camps each get their own
// bespoke storefront; everything else uses the standard Storefront. All
// are intentionally event-bespoke and not migrated to the shared dark
// form shell. An explicit brand always wins; the legacy slug/title
// heuristic only runs for unmigrated rows (brand null/empty) so they
// still route correctly until every event row has its brand set.
function resolveEventBrand(event: {
  brand?: string | null;
  public_slug?: string | null;
  title?: string | null;
}): EventBrand {
  if (event.brand === "the_send") return "the_send";
  if (event.brand === "ffsa_camps") return "ffsa_camps";
  if (event.brand) return "ff";
  const slug = (event.public_slug ?? "").toLowerCase();
  const title = (event.title ?? "").toLowerCase();
  if (slug.includes("the-send") || title.includes("the send")) return "the_send";
  if (slug.includes("ffsa-camps") || slug.includes("camps") || title.includes("camps"))
    return "ffsa_camps";
  return "ff";
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

  const brand = resolveEventBrand(event);
  if (brand === "the_send") {
    return (
      <TheSendStorefront event={eventProps} ticketTypes={ticketTypes ?? []} />
    );
  }
  if (brand === "ffsa_camps") {
    return <CampsStorefront event={eventProps} ticketTypes={ticketTypes ?? []} />;
  }

  return <Storefront event={eventProps} ticketTypes={ticketTypes ?? []} />;
}
