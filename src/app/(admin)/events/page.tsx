import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { getEvents } from "@/services/events";
import type { Event } from "@/types/database";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "events");
  const { data: events, count } = await getEvents(supabase, {
    status: params.status,
  });

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    published: "default",
    cancelled: "destructive",
    completed: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="page-eyebrow">EVENTS &amp; GATHERINGS</p>
          <h1 className="page-title">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">{count ?? 0} events</p>
        </div>
        <Link href="/events/new">
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 flex-wrap">
        {[undefined, "draft", "published", "completed", "cancelled"].map(
          (status) => {
            const isActive = (params.status ?? undefined) === status;
            return (
              <Link
                key={status ?? "all"}
                href={`/events${status ? `?status=${status}` : ""}`}
              >
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="capitalize"
                >
                  {status ?? "All"}
                </Button>
              </Link>
            );
          }
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Public</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!events || events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No events found
                </TableCell>
              </TableRow>
            ) : (
              (events as Event[]).map((event) => (
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
                    {event.end_date && event.end_date !== event.start_date
                      ? ` – ${event.end_date}`
                      : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.location ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusColors[event.status] ?? "outline"}
                      className="capitalize"
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.is_public ? "Yes" : "No"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
