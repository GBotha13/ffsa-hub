import Link from "next/link";
import { redirect } from "next/navigation";
import { getVehicleAccess } from "@/services/vehicles";
import { createClient } from "@/lib/supabase/server";
import { loadFleet, requireFleet } from "@/lib/fleet/load";
import { inUse } from "@/lib/fleet/rules";
import { Masthead, MastheadAction } from "@/components/ffsa";
import { FLEET } from "../_components/ui";
import { buildVisitCtx, lastProvider } from "../[vehicleId]/visit-ctx";
import { BookPickButton, type BookCtx } from "./calendar-client";
import { calMoveHref, calStartOf, calendarGrid, clashItems, dueItems, gapChoices, listItems, missingServiceText, noneDueText } from "./model";
import { BookSection, ClashSection, Legend, ListSection, Timeline } from "./sections";

const CAL = `${FLEET}/calendar`;
const navBtn = "inline-flex min-h-11 items-center border border-ink bg-white px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink hover:bg-bone";

// Calendar (SPEC 5.6; the Fleet app's calendarView): four weeks of trips, rentals and
// workshop visits per vehicle, then clashes, workshop visits to book and a list view.
// ?start=YYYY-MM-DD moves the four weeks (the app's Week back / This week / Week forward).
export default async function FleetCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { access, user } = await requireFleet(supabase);
  // One calendar (Fleet part 5b; Jack, 22 Nov 2026): the booking board shows Fleet's
  // workshop visits, inspection days and clashes, so whoever can open it goes there. This
  // page stays only for Fleet users without the board, until part 5d removes it.
  const va = await getVehicleAccess(supabase, user.id);
  if (va.canApprove || va.canManage) {
    const s = Array.isArray(sp.start) ? sp.start[0] : sp.start;
    redirect(`/bookings/vehicles/board${s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `?from=${s}` : ""}`);
  }
  const { F, providers } = await loadFleet(supabase);
  const canWrite = access.canManage;
  const start = calStartOf(sp.start, F.today);
  const grid = calendarGrid(F, start);
  const clashes = clashItems(F);
  const due = dueItems(F);
  const choices = gapChoices(F);
  // The booking form's context for each vehicle in use (only built for people who can book).
  const ctxs: Record<string, BookCtx> = canWrite
    ? Object.fromEntries(F.vehicles.filter(inUse).map((v) => [v.id, { ctx: buildVisitCtx(F, providers, v.id), provider: lastProvider(F, v.id, providers) }]))
    : {};

  return (
    <>
      <Masthead
        context="Fleet · Trips, rentals and workshop visits"
        title="Calendar"
        actions={
          canWrite && (
            <>
              <MastheadAction href="/bookings/vehicles/new">Add trip or rental</MastheadAction>
              {choices.length > 0 && <BookPickButton choices={choices} ctxs={ctxs} />}
            </>
          )
        }
      />
      <p className="px-5 pt-4 text-[14px] text-[#55524A] md:px-8">Trips, rentals and workshop visits for the next four weeks. Clashes show in red.</p>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
        <strong className="font-display text-[18px] font-black uppercase tabular-nums">{grid.label}</strong>
        <nav aria-label="Weeks" className="flex flex-wrap gap-2">
          <Link href={calMoveHref(CAL, start, -7)} aria-label="Previous week" className={navBtn}>
            ← Week
          </Link>
          <Link href={calMoveHref(CAL, start, 0)} className={navBtn}>
            This week
          </Link>
          <Link href={calMoveHref(CAL, start, 7)} aria-label="Next week" className={navBtn}>
            Week →
          </Link>
        </nav>
      </div>

      {grid.rows.length ? (
        <Timeline grid={grid} />
      ) : (
        <p className="border-y border-rule px-5 py-4 text-[14px] md:px-8">No vehicles in use.</p>
      )}
      <Legend />

      <ClashSection items={clashes} ctxs={ctxs} canWrite={canWrite} />
      <BookSection due={due} noneDue={noneDueText()} missing={missingServiceText(F)} choices={choices} ctxs={ctxs} canWrite={canWrite} />
      <ListSection items={listItems(F, start)} />
    </>
  );
}
