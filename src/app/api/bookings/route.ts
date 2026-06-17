import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/api-auth";
import {
  getBookingAccess,
  getVenueBookingsBetween,
  insertBooking,
  insertBookings,
  insertSeries,
  deleteSeries,
} from "@/services/bookings";
import { weeklyOccurrenceDates } from "@/lib/bookings/recurrence";
import { findConflicts, type BookingWindow } from "@/lib/bookings/conflicts";

type CreateBody = {
  dryRun?: boolean;
  venue_id?: string;
  ministry_id?: string | null;
  title?: string;
  description?: string;
  point_person?: string;
  requester_name?: string;
  start_time?: string;
  end_time?: string;
  setup_time?: string;
  setdown_time?: string;
  recurrence?: "none" | "weekly";
  booking_date?: string;
  end_date?: string;
  weekday?: number;
  series_start?: string;
  series_end?: string;
};

type Conflict = { date: string; existingId: string; existingTitle: string };

function nn(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

// POST /api/bookings — create a one-off or recurring-weekly booking request.
// Pass { dryRun: true } to only return clashes (used by the form before submit).
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const access = await getBookingAccess(supabase, user.id);
  if (!(access.canRequest || access.canApprove || access.canManage)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const venueId = nn(body.venue_id);
  const title = nn(body.title);
  if (!venueId) return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const recurrence = body.recurrence === "weekly" ? "weekly" : "none";
  const times = {
    start_time: nn(body.start_time),
    end_time: nn(body.end_time),
    setup_time: nn(body.setup_time),
    setdown_time: nn(body.setdown_time),
  };

  // Resolve the candidate occurrence dates.
  let occurrences: { booking_date: string; end_date: string | null }[] = [];
  let weekday: number | null = null;
  let seriesStart: string | null = null;
  let seriesEnd: string | null = null;

  if (recurrence === "weekly") {
    weekday = typeof body.weekday === "number" ? body.weekday : NaN;
    seriesStart = nn(body.series_start);
    seriesEnd = nn(body.series_end);
    if (weekday === null || Number.isNaN(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: "weekday (0–6) is required" }, { status: 400 });
    }
    if (!seriesStart || !seriesEnd) {
      return NextResponse.json({ error: "series_start and series_end are required" }, { status: 400 });
    }
    if (seriesEnd < seriesStart) {
      return NextResponse.json({ error: "series_end must be on or after series_start" }, { status: 400 });
    }
    const dates = weeklyOccurrenceDates(seriesStart, seriesEnd, weekday);
    if (dates.length === 0) {
      return NextResponse.json({ error: "No dates in that range fall on the chosen weekday" }, { status: 400 });
    }
    occurrences = dates.map((d) => ({ booking_date: d, end_date: null }));
  } else {
    const bookingDate = nn(body.booking_date);
    const endDate = nn(body.end_date);
    if (!bookingDate) {
      return NextResponse.json({ error: "booking_date is required" }, { status: 400 });
    }
    if (endDate && endDate < bookingDate) {
      return NextResponse.json({ error: "end_date must be on or after the start date" }, { status: 400 });
    }
    occurrences = [{ booking_date: bookingDate, end_date: endDate }];
  }

  // ── Conflict scan over the window touched by this request ──
  const allDates = occurrences
    .flatMap((o) => [o.booking_date, o.end_date ?? o.booking_date])
    .sort();
  const rangeFrom = allDates[0];
  const rangeTo = allDates[allDates.length - 1];

  const { data: existingRaw } = await getVenueBookingsBetween(
    supabase,
    venueId,
    rangeFrom,
    rangeTo
  );
  const existing = (existingRaw ?? []) as (BookingWindow & { title?: string })[];

  const conflicts: Conflict[] = [];
  for (const occ of occurrences) {
    const candidate: BookingWindow = {
      id: "",
      venue_id: venueId,
      booking_date: occ.booking_date,
      end_date: occ.end_date,
      status: "pending",
      ...times,
    };
    for (const c of findConflicts(candidate, existing)) {
      conflicts.push({
        date: occ.booking_date,
        existingId: c.id,
        existingTitle: (c as { title?: string }).title ?? "another booking",
      });
    }
  }

  if (body.dryRun) {
    return NextResponse.json({ ok: true, conflicts });
  }

  // ── Persist ──
  let requesterName = nn(body.requester_name);
  if (!requesterName) {
    const { data: u } = await supabase
      .from("users")
      .select("first_name,last_name")
      .eq("id", user.id)
      .single();
    if (u) requesterName = [u.first_name, u.last_name].filter(Boolean).join(" ") || null;
  }

  const ministryId = nn(body.ministry_id);
  const shared = {
    venue_id: venueId,
    ministry_id: ministryId,
    title,
    description: nn(body.description),
    point_person: nn(body.point_person),
    ...times,
  };

  if (recurrence === "weekly") {
    const { data: series, error: seriesErr } = await insertSeries(supabase, {
      ...shared,
      weekday,
      series_start: seriesStart,
      series_end: seriesEnd,
      status: "pending",
      created_by: user.id,
    });

    if (seriesErr || !series) {
      return NextResponse.json(
        { error: seriesErr?.message ?? "Failed to create series" },
        { status: 500 }
      );
    }

    const rows = occurrences.map((o) => ({
      ...shared,
      series_id: series.id,
      booking_date: o.booking_date,
      end_date: null,
      status: "pending",
      requested_by: user.id,
      requester_name: requesterName,
    }));

    const { error: occErr } = await insertBookings(supabase, rows);
    if (occErr) {
      // Best-effort cleanup so we don't leave an empty series behind.
      await deleteSeries(supabase, series.id);
      return NextResponse.json({ error: occErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      seriesId: series.id,
      count: rows.length,
      conflicts,
    });
  }

  // One-off
  const { data: booking, error: bookingErr } = await insertBooking(supabase, {
    ...shared,
    booking_date: occurrences[0].booking_date,
    end_date: occurrences[0].end_date,
    status: "pending",
    requested_by: user.id,
    requester_name: requesterName,
  });

  if (bookingErr || !booking) {
    return NextResponse.json(
      { error: bookingErr?.message ?? "Failed to create booking" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, bookingId: booking.id, conflicts });
}
