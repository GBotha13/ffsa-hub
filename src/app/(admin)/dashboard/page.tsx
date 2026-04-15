import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Calendar, UserCheck, ClipboardCheck } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch counts in parallel
  const [contactsResult, eventsResult, usersResult, recentRegistrations, upcomingEvents] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("event_registrations")
        .select(
          "id, status, registered_at, contacts!contact_id(first_name, last_name, preferred_name), events!event_id(title)"
        )
        .order("registered_at", { ascending: false })
        .limit(10),
      supabase
        .from("events")
        .select("id, title, start_date, location, status")
        .eq("status", "published")
        .gte("start_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .limit(5),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your FFSA operations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Contacts
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{contactsResult.count ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Published Events
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{eventsResult.count ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{usersResult.count ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Registrations
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {recentRegistrations.data?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!upcomingEvents.data || upcomingEvents.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-6"
                    >
                      No upcoming events
                    </TableCell>
                  </TableRow>
                ) : (
                  (upcomingEvents.data as Array<{ id: string; title: string; start_date: string; location: string | null; status: string }>).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Link
                          href={`/events/${event.id}`}
                          className="font-medium hover:underline"
                        >
                          {event.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.start_date}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.location ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!recentRegistrations.data ||
                recentRegistrations.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-6"
                    >
                      No recent registrations
                    </TableCell>
                  </TableRow>
                ) : (
                  recentRegistrations.data.map(
                    (reg) => {
                      const contact = Array.isArray(reg.contacts) ? reg.contacts[0] : reg.contacts;
                      const event = Array.isArray(reg.events) ? reg.events[0] : reg.events;
                      return (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">
                          {contact
                            ? `${contact.preferred_name ?? contact.first_name} ${contact.last_name}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {event?.title ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {reg.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                    })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
