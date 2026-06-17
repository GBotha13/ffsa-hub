"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  CalendarDays,
  List as ListIcon,
} from "lucide-react";
import {
  monthParam,
  monthLabel,
  shiftMonth,
} from "@/lib/bookings/dates";
import { conflictingIds, type BookingWindow } from "@/lib/bookings/conflicts";
import type {
  BookingAccess,
  BookingWithRefs,
  Venue,
  Ministry,
} from "@/services/bookings";
import { BookingCalendar } from "./booking-calendar";
import { BookingList } from "./booking-list";

type Filters = { venue: string; ministry: string; status: string };

export function BookingsView({
  bookings,
  venues,
  ministries,
  access,
  view,
  year,
  month,
  filters,
}: {
  bookings: BookingWithRefs[];
  venues: Venue[];
  ministries: Ministry[];
  access: BookingAccess;
  view: "calendar" | "list";
  year: number;
  month: number;
  filters: Filters;
}) {
  const router = useRouter();

  function buildHref(overrides: Partial<Filters & { view: string; month: string }>) {
    const next = {
      view,
      month: monthParam(year, month),
      venue: filters.venue,
      ministry: filters.ministry,
      status: filters.status,
      ...overrides,
    };
    const sp = new URLSearchParams();
    if (next.view && next.view !== "calendar") sp.set("view", next.view);
    if (next.month) sp.set("month", next.month);
    if (next.venue && next.venue !== "all") sp.set("venue", next.venue);
    if (next.ministry && next.ministry !== "all") sp.set("ministry", next.ministry);
    if (next.status && next.status !== "all") sp.set("status", next.status);
    const qs = sp.toString();
    return `/bookings${qs ? `?${qs}` : ""}`;
  }

  function go(overrides: Partial<Filters & { view: string; month: string }>) {
    router.push(buildHref(overrides));
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const now = new Date();
  const thisMonth = monthParam(now.getFullYear(), now.getMonth() + 1);

  const clashIds = conflictingIds(bookings as unknown as BookingWindow[]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="page-eyebrow">VENUE SCHEDULING</p>
          <h1 className="page-title">Space Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"} in view
          </p>
        </div>
        <div className="flex items-center gap-2">
          {access.canManage && (
            <Link href="/bookings/venues">
              <Button variant="outline" size="sm" className="gap-1">
                <Settings2 className="h-4 w-4" />
                Manage venues
              </Button>
            </Link>
          )}
          {(access.canRequest || access.canApprove || access.canManage) && (
            <Link href="/bookings/new">
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                New booking
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go({ month: monthParam(prev.year, prev.month) })}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center text-sm font-semibold">
            {monthLabel(year, month)}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go({ month: monthParam(next.year, next.month) })}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1"
            onClick={() => go({ month: thisMonth })}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Venue filter */}
          <Select value={filters.venue} onValueChange={(v) => go({ venue: v })}>
            <SelectTrigger className="h-8 w-[9.5rem] text-xs">
              <SelectValue placeholder="Venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All venues</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Ministry filter */}
          <Select value={filters.ministry} onValueChange={(v) => go({ ministry: v })}>
            <SelectTrigger className="h-8 w-[9.5rem] text-xs">
              <SelectValue placeholder="Ministry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ministries</SelectItem>
              {ministries.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={filters.status} onValueChange={(v) => go({ status: v })}>
            <SelectTrigger className="h-8 w-[8rem] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center rounded-md border bg-card p-0.5">
            <Button
              variant={view === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => go({ view: "calendar" })}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => go({ view: "list" })}
            >
              <ListIcon className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <BookingCalendar
          bookings={bookings}
          venues={venues}
          clashIds={clashIds}
          year={year}
          month={month}
        />
      ) : (
        <BookingList bookings={bookings} clashIds={clashIds} />
      )}
    </div>
  );
}
