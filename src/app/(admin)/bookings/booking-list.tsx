"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { statusBadgeClass, statusLabel } from "@/lib/bookings/status";
import { dateRangeLabel, timeRangeLabel, timeLabel } from "@/lib/bookings/dates";
import type { BookingWithRefs } from "@/services/bookings";

export function BookingList({
  bookings,
  clashIds,
}: {
  bookings: BookingWithRefs[];
  clashIds: Set<string>;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Venue</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Ministry</TableHead>
            <TableHead>Date(s)</TableHead>
            <TableHead>Event time</TableHead>
            <TableHead>Set-up</TableHead>
            <TableHead>Set-down</TableHead>
            <TableHead>Point person</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No bookings in this view
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((b) => {
              const clash = clashIds.has(b.id);
              return (
                <TableRow key={b.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", statusBadgeClass(b.status))}
                    >
                      {statusLabel(b.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: b.venue?.color ?? "#64748b" }}
                      />
                      {b.venue?.name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="font-medium hover:underline"
                    >
                      {b.title}
                    </Link>
                    {b.series_id && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        · weekly
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {b.ministry ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: b.ministry.color }}
                        />
                        {b.ministry.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {clash && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-red-500"
                          aria-label="Clashes with another booking"
                        />
                      )}
                      {dateRangeLabel(b.booking_date, b.end_date)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {timeRangeLabel(b.start_time, b.end_time)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {timeLabel(b.setup_time)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {timeLabel(b.setdown_time)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {b.point_person || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
