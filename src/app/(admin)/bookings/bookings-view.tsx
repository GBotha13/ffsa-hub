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
  CalendarRange,
  Clock,
  List as ListIcon,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  monthParam,
  monthLabel,
  shiftMonth,
  shiftDays,
  weekRangeLabel,
  dayHeadingLabel,
  todayISO,
} from "@/lib/bookings/dates";
import { conflictingIds, type BookingWindow } from "@/lib/bookings/conflicts";
import { statusColor, statusLabel } from "@/lib/bookings/status";
import type {
  BookingAccess,
  BookingWithRefs,
  Venue,
  Ministry,
} from "@/services/bookings";
import { BookingCalendar } from "./booking-calendar";
import { BookingList } from "./booking-list";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { ColorDot } from "./ui";

type ViewKind = "month" | "week" | "day" | "list";
type Filters = { venue: string; ministry: string; status: string };

const VIEW_OPTIONS: { key: ViewKind; label: string; icon: typeof CalendarDays }[] = [
  { key: "month", label: "Month", icon: CalendarDays },
  { key: "week", label: "Week", icon: CalendarRange },
  { key: "day", label: "Day", icon: Clock },
  { key: "list", label: "List", icon: ListIcon },
];

export function BookingsView({
  bookings,
  venues,
  ministries,
  access,
  view,
  date,
  year,
  month,
  filters,
}: {
  bookings: BookingWithRefs[];
  venues: Venue[];
  ministries: Ministry[];
  access: BookingAccess;
  view: ViewKind;
  date: string;
  year: number;
  month: number;
  filters: Filters;
}) {
  const router = useRouter();
  const today = todayISO();

  function buildHref(
    overrides: Partial<Filters & { view: ViewKind; date: string }>
  ) {
    const next = { view, date, ...filters, ...overrides };
    const sp = new URLSearchParams();
    if (next.view && next.view !== "month") sp.set("view", next.view);
    if (next.date && next.date !== today) sp.set("date", next.date);
    if (next.venue !== "all") sp.set("venue", next.venue);
    if (next.ministry !== "all") sp.set("ministry", next.ministry);
    if (next.status !== "all") sp.set("status", next.status);
    const qs = sp.toString();
    return `/bookings${qs ? `?${qs}` : ""}`;
  }

  function go(overrides: Partial<Filters & { view: ViewKind; date: string }>) {
    router.push(buildHref(overrides));
  }

  // Period navigation depends on the active view.
  let prevDate: string;
  let nextDate: string;
  let headerLabel: string;
  let unit: string;
  if (view === "week") {
    prevDate = shiftDays(date, -7);
    nextDate = shiftDays(date, 7);
    headerLabel = weekRangeLabel(date);
    unit = "week";
  } else if (view === "day") {
    prevDate = shiftDays(date, -1);
    nextDate = shiftDays(date, 1);
    headerLabel = dayHeadingLabel(date);
    unit = "day";
  } else {
    const pm = shiftMonth(year, month, -1);
    const nm = shiftMonth(year, month, 1);
    prevDate = `${monthParam(pm.year, pm.month)}-01`;
    nextDate = `${monthParam(nm.year, nm.month)}-01`;
    headerLabel = monthLabel(year, month);
    unit = "month";
  }

  const clashIds = conflictingIds(bookings as unknown as BookingWindow[]);

  const counts = { pending: 0, approved: 0, denied: 0, cancelled: 0 };
  for (const b of bookings) counts[b.status] = (counts[b.status] ?? 0) + 1;

  const stats: { key: string; label: string; value: number; color?: string; status?: string }[] = [
    { key: "all", label: "In view", value: bookings.length, status: "all" },
    { key: "pending", label: "Pending", value: counts.pending, color: statusColor("pending"), status: "pending" },
    { key: "approved", label: "Approved", value: counts.approved, color: statusColor("approved"), status: "approved" },
    { key: "denied", label: "Denied", value: counts.denied, color: statusColor("denied"), status: "denied" },
    { key: "clashes", label: "Clashes", value: clashIds.size, color: "hsl(0 70% 62%)" },
  ];

  // Day view shows a column per venue (respecting an active venue filter).
  const columnVenues = venues.filter(
    (v) => v.is_active && (filters.venue === "all" || v.id === filters.venue)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="page-eyebrow">VENUE SCHEDULING</p>
          <h1 className="page-title">Space Bookings</h1>
        </div>
        <div className="flex items-center gap-2">
          {access.canManage && (
            <Link href="/bookings/venues">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                Manage venues
              </Button>
            </Link>
          )}
          {(access.canRequest || access.canApprove || access.canManage) && (
            <Link href="/bookings/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New booking
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map((s) => {
          const active = s.status && filters.status === s.status;
          const isClashes = s.key === "clashes";
          const inner = (
            <>
              <div
                className="text-2xl font-bold tabular-nums leading-none"
                style={{ color: s.value === 0 && isClashes ? undefined : s.color }}
              >
                {s.value}
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {isClashes && s.value > 0 && (
                  <AlertTriangle className="h-3 w-3 text-[hsl(0_70%_62%)]" />
                )}
                {s.label}
              </div>
            </>
          );
          const base = "rounded-xl border bg-card px-3.5 py-3 text-left transition-all";
          if (isClashes) {
            return (
              <div key={s.key} className={cn(base, s.value > 0 && "border-destructive/40")}>
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={s.key}
              href={buildHref({ status: s.status })}
              className={cn(
                base,
                "hover:-translate-y-px hover:border-[hsl(22_8%_20%)]",
                active && "border-primary/55 ring-1 ring-primary/30"
              )}
            >
              {inner}
            </Link>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go({ date: prevDate })}
            aria-label={`Previous ${unit}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[11rem] text-center text-base font-semibold tracking-wide">
            {headerLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go({ date: nextDate })}
            aria-label={`Next ${unit}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="ml-1" onClick={() => go({ date: today })}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          <div className="flex items-center rounded-lg border bg-card p-0.5">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.key}
                  variant={view === opt.key ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={() => go({ view: opt.key })}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{opt.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      {view !== "list" && (
        <div className="-mt-1 flex items-center justify-end gap-4 text-[10px] text-muted-foreground">
          {["pending", "approved", "denied", "cancelled"].map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <ColorDot color={statusColor(s)} className="h-2 w-2" />
              {statusLabel(s)}
            </span>
          ))}
          <span className="hidden text-[hsl(30_6%_34%)] sm:inline">· bar = venue</span>
        </div>
      )}

      {view === "list" ? (
        <BookingList
          bookings={bookings}
          clashIds={clashIds}
          canCreate={access.canRequest || access.canApprove || access.canManage}
        />
      ) : view === "week" ? (
        <WeekView bookings={bookings} venues={venues} date={date} clashIds={clashIds} />
      ) : view === "day" ? (
        <DayView bookings={bookings} venues={columnVenues} date={date} clashIds={clashIds} />
      ) : (
        <BookingCalendar
          bookings={bookings}
          venues={venues}
          clashIds={clashIds}
          year={year}
          month={month}
        />
      )}
    </div>
  );
}
