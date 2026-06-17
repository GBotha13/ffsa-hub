// Shared booking-status vocabulary + styling, so the calendar, list, and
// detail views all render statuses identically (mirrors the green / amber /
// red colouring of the original spreadsheet).

export const BOOKING_STATUSES = [
  "pending",
  "approved",
  "denied",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** Tailwind classes for a status pill (use with Badge variant="outline"). */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "pending":
      return "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "denied":
      return "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400";
    case "cancelled":
      return "border-border bg-muted text-muted-foreground line-through";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

/** A faint left-border / background tint for calendar chips by status. */
export function statusChipClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "pending":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "denied":
      return "bg-red-500/10 text-red-700/70 dark:text-red-300/70 line-through";
    case "cancelled":
      return "bg-muted text-muted-foreground line-through";
    default:
      return "bg-muted text-muted-foreground";
  }
}
