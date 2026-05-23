import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/services/events";
import { getRegistrationsForEvent } from "@/services/registrations";
import { getAttendanceForEvent } from "@/services/attendance";
import { getEventOutcomes } from "@/services/event-outcomes";
import { getEventRoles } from "@/services/event-roles";
import { getLabels } from "@/services/labels";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutcomesManager } from "./outcomes-manager";
import { RolesRoster } from "./roles-roster";
import { BaseLabelPicker } from "./base-label-picker";
import { FormsTab } from "./forms-tab";
import { EventLogo } from "./event-logo";
import { TicketsTab } from "./tickets-tab";
import {
  listTicketTypesByEvent,
  listPromoCodesByEvent,
  getActiveFeeProfiles,
} from "@/services/ticketing";
import type { FeeProfile } from "@/lib/payments/pricing";

const TABS = [
  { key: "details", label: "Details & Roles" },
  { key: "tickets", label: "Tickets" },
  { key: "forms", label: "Forms" },
] as const;

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "details";

  const supabase = await createClient();

  const { data: event, error } = await getEventById(supabase, id);
  if (error || !event) notFound();

  const [
    { data: registrations },
    { data: attendance },
    { data: outcomes },
    { data: roles },
    { data: labels },
    { data: users },
    { data: forms },
    { data: ticketTypes },
    { data: promoCodes },
    { data: feeProfilesRaw },
  ] = await Promise.all([
    getRegistrationsForEvent(supabase, id),
    getAttendanceForEvent(supabase, id),
    getEventOutcomes(supabase, id),
    getEventRoles(supabase, id),
    getLabels(supabase, { active: true }),
    supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("forms")
      .select("id, slug, name, is_active, records_attendance")
      .eq("event_id", id)
      .order("created_at"),
    listTicketTypesByEvent(supabase, id),
    listPromoCodesByEvent(supabase, id),
    getActiveFeeProfiles(supabase),
  ]);

  // payment_fee_profiles rows are snake_case in the DB; FeeProfile
  // (pricing.ts) is camelCase. Map once here for the client preview.
  const feeProfiles: FeeProfile[] = (feeProfilesRaw ?? []).map(
    (p: { provider: string; percent_bps: number; fixed_cents: number }) => ({
      provider: p.provider,
      percentBps: p.percent_bps,
      fixedCents: p.fixed_cents,
    })
  );

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    published: "default",
    cancelled: "destructive",
    completed: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/events"
          className="text-xs text-muted-foreground hover:text-foreground uppercase"
          style={{ letterSpacing: "0.15em" }}
        >
          ← Events
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="page-eyebrow">EVENTS &amp; GATHERINGS</p>
          <h1 className="page-title">{event.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {event.start_date}
            {event.end_date && event.end_date !== event.start_date
              ? ` – ${event.end_date}`
              : ""}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <Badge variant={statusColors[event.status]} className="capitalize">
          {event.status}
        </Badge>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/events/${id}?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "details" && (
        <DetailsTab
          event={event}
          eventId={id}
          outcomes={outcomes ?? []}
          roles={roles ?? []}
          labels={labels ?? []}
          users={users ?? []}
          registrations={registrations ?? []}
          attendance={attendance ?? []}
        />
      )}

      {tab === "tickets" && (
        <TicketsTab
          eventId={id}
          ticketingEnabled={event.ticketing_enabled ?? false}
          publicSlug={event.public_slug ?? null}
          ticketTypes={ticketTypes ?? []}
          promoCodes={promoCodes ?? []}
          feeProfiles={feeProfiles}
        />
      )}

      {tab === "forms" && <FormsTab eventId={id} forms={forms ?? []} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Details & Roles tab
// ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailsTab(props: any) {
  const { event, eventId, outcomes, roles, labels, users, registrations, attendance } =
    props;

  const regStatusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    confirmed: "default",
    waitlisted: "secondary",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6">
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Registrations" value={registrations.length} />
        <StatCard
          label="Attendance"
          value={
            attendance.filter((a: { status: string }) => a.status === "present").length
          }
        />
        <StatCard label="Capacity" value={event.max_capacity ?? "Unlimited"} />
      </div>

      <EventLogo eventId={eventId} logoUrl={event.logo_url} />

      <BaseLabelPicker
        eventId={eventId}
        currentLabelId={event.base_label_id}
        labels={labels}
      />

      <OutcomesManager eventId={eventId} outcomes={outcomes} labels={labels} />

      <RolesRoster eventId={eventId} roles={roles} users={users} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No registrations yet
                  </TableCell>
                </TableRow>
              ) : (
                registrations.map(
                  (reg: {
                    id: string;
                    status: string;
                    registered_at: string;
                    contacts: {
                      first_name: string;
                      last_name: string;
                      preferred_name: string | null;
                      email: string | null;
                    } | null;
                  }) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">
                        {reg.contacts
                          ? `${reg.contacts.preferred_name ?? reg.contacts.first_name} ${reg.contacts.last_name}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {reg.contacts?.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={regStatusColors[reg.status]} className="capitalize">
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(reg.registered_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
