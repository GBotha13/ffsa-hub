// Test helper: the FFSA Fleet export in vehicles-module/seed/db as FleetData.
// Used by tests only. The seed is FFSA's real data: never copy it anywhere public.

import fs from "node:fs";
import path from "node:path";
import type { Checklist, FleetData, FleetVehicle, ISODate, Schedule, Trip, WorkshopVisit } from "../rules/types";

const SEED = path.resolve(__dirname, "../../../../vehicles-module/seed/db");
const read = <T>(name: string): Record<string, T> => JSON.parse(fs.readFileSync(path.join(SEED, name + ".json"), "utf8"));
const withIds = <T>(m: Record<string, T>) => Object.entries(m).map(([id, d]) => Object.assign({ id }, d));

export function seedFleetData(today: ISODate): FleetData {
  const config = read<unknown>("config") as { checklist: Checklist; schedule: Schedule; notify: Record<string, unknown> };
  const vehicles = (withIds(read<Omit<FleetVehicle, "id">>("fleet")) as (FleetVehicle & { sort?: number })[]).sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0)
  );
  return {
    today,
    vehicles,
    trips: withIds(read<Omit<Trip, "id">>("trips")) as Trip[],
    visits: withIds(read<Omit<WorkshopVisit, "id">>("records")) as WorkshopVisit[],
    checklist: config.checklist,
    schedule: config.schedule,
    notify: config.notify,
    providers: withIds(read<{ name: string }>("providers")),
    timelog: [],
  };
}

/** A copy of the data with one vehicle changed. */
export function withVehicle(F: FleetData, id: string, patch: Partial<FleetVehicle>): FleetData {
  return { ...F, vehicles: F.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
}
