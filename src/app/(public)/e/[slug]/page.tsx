import { createClient } from "@/lib/supabase/server";
import { getEventBySlug } from "@/services/events";
import { listTicketTypesByEvent } from "@/services/ticketing";
import { Storefront } from "./storefront";
import { TheSendStorefront } from "./the-send-storefront";

// Bespoke landing pages keyed by event slug. THE SEND gets its own
// branded storefront; everything else uses the standard Storefront.
function isTheSend(slug: string, title: string): boolean {
  const s = slug.toLowerCase();
  return s.includes("the-send") || title.toLowerCase().includes("the send");
}

export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await getEventBySlug(supabase, slug);
  if (
    !event ||
    !event.ticketing_enabled ||
    event.status !== "published"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Event not available</h1>
          <p className="text-sm text-gray-600 mt-1">
            This event may have ended, been moved, or the link is incorrect.
          </p>
        </div>
      </div>
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

  if (isTheSend(slug, event.title)) {
    return (
      <TheSendStorefront event={eventProps} ticketTypes={ticketTypes ?? []} />
    );
  }

  return <Storefront event={eventProps} ticketTypes={ticketTypes ?? []} />;
}
