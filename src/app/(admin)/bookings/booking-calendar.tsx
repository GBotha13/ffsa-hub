"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { AlertTriangle } from "lucide-react";
import {
  monthGridDays,
  monthParam,
  WEEKDAY_HEADERS,
  isoMonth,
  isoDay,
  todayISO,
  expandBookingDays,
  timeLabel,
} from "@/lib/bookings/dates";
import { statusChipClass } from "@/lib/bookings/status";
import type { BookingWithRefs, Venue } from "@/services/bookings";

const MAX_CHIPS = 3;

export function BookingCalendar({
  bookings,
  venues,
  clashIds,
  year,
  month,
}: {
  bookings: BookingWithRefs[];
  venues: Venue[];
  clashIds: Set<string>;
  year: number;
  month: number;
}) {
  const days = monthGridDays(year, month);
  const today = todayISO();

  const venueColor = new Map(venues.map((v) => [v.id, v.color]));

  // Bucket bookings onto each day they cover.
  const byDay = new Map<string, BookingWithRefs[]>();
  for (const b of bookings) {
    for (const d of expandBookingDays(b)) {
      const arr = byDay.get(d);
      if (arr) arr.push(b);
      else byDay.set(d, [b]);
    }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_HEADERS.map((wd) => (
          <div
            key={wd}
            className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* 6-week grid */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = isoMonth(d) === month;
          const isToday = d === today;
          const dayBookings = byDay.get(d) ?? [];
          const shown = dayBookings.slice(0, MAX_CHIPS);
          const extra = dayBookings.length - shown.length;

          return (
            <div
              key={d}
              className={cn(
                "min-h-[6.5rem] border-b border-r p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                i >= 35 && "border-b-0",
                !inMonth && "bg-muted/20"
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span
                  className={cn(
                    "text-xs font-medium",
                    !inMonth && "text-muted-foreground/50",
                    isToday &&
                      "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  )}
                >
                  {isoDay(d)}
                </span>
              </div>

              <div className="mt-0.5 space-y-0.5">
                {shown.map((b) => {
                  const clash = clashIds.has(b.id);
                  const color = venueColor.get(b.venue_id) ?? "#64748b";
                  const t = timeLabel(b.start_time);
                  return (
                    <Link
                      key={`${b.id}-${d}`}
                      href={`/bookings/${b.id}`}
                      title={`${b.title} · ${b.venue?.name ?? ""}`}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight hover:ring-1 hover:ring-ring",
                        statusChipClass(b.status)
                      )}
                    >
                      <span
                        className="h-2.5 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {clash && (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                      )}
                      <span className="truncate">
                        {t !== "—" ? <span className="opacity-70">{t} </span> : null}
                        {b.title}
                      </span>
                    </Link>
                  );
                })}
                {extra > 0 && (
                  <Link
                    href={`/bookings?view=list&month=${monthParam(year, month)}`}
                    className="block px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    +{extra} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
