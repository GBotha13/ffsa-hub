import { TicketingSettings } from "./ticketing-settings";
import { TicketTypesManager } from "./ticket-types-manager";
import { PromoCodesManager } from "./promo-codes-manager";
import type { FeeProfile } from "@/lib/payments/pricing";

// Composer for the Tickets tab on the event detail page. The
// individual sub-managers handle their own CRUD via API routes;
// data is fetched server-side in page.tsx and passed through.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TicketTypeRow = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromoCodeRow = any;

export function TicketsTab({
  eventId,
  ticketingEnabled,
  publicSlug,
  ticketTypes,
  promoCodes,
  feeProfiles,
}: {
  eventId: string;
  ticketingEnabled: boolean;
  publicSlug: string | null;
  ticketTypes: TicketTypeRow[];
  promoCodes: PromoCodeRow[];
  feeProfiles: FeeProfile[];
}) {
  return (
    <div className="space-y-6">
      <TicketingSettings
        eventId={eventId}
        ticketingEnabled={ticketingEnabled}
        publicSlug={publicSlug}
      />
      <TicketTypesManager
        eventId={eventId}
        ticketTypes={ticketTypes}
        feeProfiles={feeProfiles}
      />
      <PromoCodesManager
        eventId={eventId}
        promoCodes={promoCodes}
        ticketTypes={ticketTypes.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
