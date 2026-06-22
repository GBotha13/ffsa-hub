// Standard vehicle-rental pricing + the single Xero item code all rentals
// post under. Rates are per-day in USD (matching the BASE VEHICLES sheet);
// the live USD→ZAR rate is applied at checkout for the ZAR card charge.

export const VEHICLE_XERO_ITEM_CODE = "VehicleRent";

export const VEHICLE_DAILY_RATE_USD: Record<"van" | "car", number> = {
  van: 68,
  car: 25,
};

/** Sum of the per-day USD rates for a set of vehicle types. */
export function standardDailyUsd(types: ("van" | "car")[]): number {
  return types.reduce((sum, t) => sum + (VEHICLE_DAILY_RATE_USD[t] ?? 0), 0);
}

/** Standard USD quote = sum of daily rates × number of days (min 1). */
export function standardQuoteUsd(types: ("van" | "car")[], days: number): number {
  return standardDailyUsd(types) * Math.max(1, days);
}
