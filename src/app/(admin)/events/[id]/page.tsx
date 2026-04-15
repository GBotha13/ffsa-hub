import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/services/events";
import { getRegistrationsForEvent } from "@/services/registrations";
import { getAttendanceForEvent } from "@/services/attendance";
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

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event, error } = await getEventById(supabase, id);
  if (error || !event) notFound();

  const { data: registrations } = await getRegistrationsForEvent(supabase, id);
  const { data: attendance } = await getAttendanceForEvent(supabase, id);

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    published: "default",
    cancelled: "destructive",
    completed: "secondary",
  };

  const regStatusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    confirmed: "default",
    waitlisted: "secondary",
    cancelled: "destructive",
  };

  const attStatusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    present: "default",
    absent: "destructive",
    late: "secondary",
    excused: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <p className="text-sm text-muted-foreground">
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

      {event.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{event.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{registrations?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {attendance?.filter((a: { status: string }) => a.status === "present").length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {event.max_capacity ?? "Unlimited"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrations</CardTitle>
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
              {!registrations || registrations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-6"
                  >
                    No registrations yet
                  </TableCell>
                </TableRow>
              ) : (
                registrations.map((reg: {
                  id: string;
                  status: string;
                  registered_at: string;
                  contacts: { first_name: string; last_name: string; preferred_name: string | null; email: string | null } | null;
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
                      <Badge
                        variant={regStatusColors[reg.status]}
                        className="capitalize"
                      >
                        {reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(reg.registered_at).toLocaleDateString()}
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
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checked In</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!attendance || attendance.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-6"
                  >
                    No attendance recorded
                  </TableCell>
                </TableRow>
              ) : (
                attendance.map((att: {
                  id: string;
                  status: string;
                  checked_in_at: string | null;
                  method: string;
                  contacts: { first_name: string; last_name: string; preferred_name: string | null; email: string | null } | null;
                }) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium">
                      {att.contacts
                        ? `${att.contacts.preferred_name ?? att.contacts.first_name} ${att.contacts.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={attStatusColors[att.status]}
                        className="capitalize"
                      >
                        {att.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {att.checked_in_at
                        ? new Date(att.checked_in_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {att.method}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
