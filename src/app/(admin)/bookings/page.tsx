import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import {
  getBookings,
  getVenues,
  getMinistries,
  getBookingAccess,
  type BookingWithRefs,
  type Venue,
  type Ministry,
} from "@/services/bookings";
import { parseMonthParam, monthGridDays } from "@/lib/bookings/dates";
import { BookingsView } from "./bookings-view";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    month?: string;
    venue?: string;
    ministry?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const [, access] = await Promise.all([
    requireModuleAccess(supabase, user.id, "bookings"),
    getBookingAccess(supabase, user.id),
  ]);

  const { year, month } = parseMonthParam(params.month);
  const grid = monthGridDays(year, month);
  const from = grid[0];
  const to = grid[grid.length - 1];

  const venueId = params.venue && params.venue !== "all" ? params.venue : undefined;
  const ministryId =
    params.ministry && params.ministry !== "all" ? params.ministry : undefined;
  const status = params.status && params.status !== "all" ? params.status : undefined;

  const [venuesRes, ministriesRes, bookingsRes] = await Promise.all([
    getVenues(supabase),
    getMinistries(supabase),
    getBookings(supabase, { from, to, venueId, ministryId, status }),
  ]);

  const venues = (venuesRes.data ?? []) as Venue[];
  const ministries = (ministriesRes.data ?? []) as Ministry[];
  const bookings = (bookingsRes.data ?? []) as BookingWithRefs[];

  return (
    <BookingsView
      bookings={bookings}
      venues={venues}
      ministries={ministries}
      access={access}
      view={params.view === "list" ? "list" : "calendar"}
      year={year}
      month={month}
      filters={{
        venue: params.venue ?? "all",
        ministry: params.ministry ?? "all",
        status: params.status ?? "all",
      }}
    />
  );
}
