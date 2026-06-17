// Shared booking-status vocabulary + styling. Everything maps onto the FFSA
// Hub brand tokens (the .status-green/yellow/red/grey pills in globals.css and
// the gold/green/red hues), so bookings read identically to the rest of the app
// and mirror the green / amber / red language of the original spreadsheet.

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

/** Brand status-pill class (defined in globals.css @layer components). */
export function statusBrandClass(status: string): string {
  switch (status) {
    case "approved":
      return "status-green";
    case "pending":
      return "status-yellow";
    case "denied":
      return "status-red";
    case "cancelled":
      return "status-grey";
    default:
      return "status-grey";
  }
}

/** Solid accent colour for a status — used for left-bars, dots, stat numbers. */
export function statusColor(status: string): string {
  switch (status) {
    case "approved":
      return "hsl(142 55% 52%)";
    case "pending":
      return "hsl(42 95% 58%)";
    case "denied":
      return "hsl(0 70% 62%)";
    case "cancelled":
      return "hsl(30 6% 46%)";
    default:
      return "hsl(30 6% 46%)";
  }
}

/** Inline style for a calendar chip, tinted by status (kept off Tailwind to
 *  avoid arbitrary-value/opacity parsing pitfalls). */
export function statusChipStyle(status: string): {
  background: string;
  color: string;
  textDecoration?: string;
  opacity?: number;
} {
  switch (status) {
    case "approved":
      return { background: "hsl(142 50% 30% / 0.30)", color: "hsl(142 52% 74%)" };
    case "pending":
      return { background: "hsl(42 95% 55% / 0.15)", color: "hsl(42 90% 70%)" };
    case "denied":
      return {
        background: "hsl(0 70% 52% / 0.15)",
        color: "hsl(0 70% 74%)",
        textDecoration: "line-through",
        opacity: 0.85,
      };
    case "cancelled":
      return {
        background: "hsl(22 8% 16%)",
        color: "hsl(30 6% 52%)",
        textDecoration: "line-through",
        opacity: 0.7,
      };
    default:
      return { background: "hsl(22 8% 16%)", color: "hsl(30 6% 60%)" };
  }
}
