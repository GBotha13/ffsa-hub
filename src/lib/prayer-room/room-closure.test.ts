import { describe, expect, it } from "vitest";

import { PRAYER_ROOM_VENUE_SLUG } from "@/lib/prayer-room/venue";
import {
  AUDITORIUM_BOOKED_LABEL,
  auditoriumClosure,
  blockoutClosure,
  closureCovering,
  johannesburgDate,
  type RoomClosure,
} from "./room-closure";

const NOV16 = "2026-11-16";

function booking(over: Partial<Parameters<typeof auditoriumClosure>[0]> = {}) {
  return auditoriumClosure({
    id: "551d5dfb",
    venueSlug: PRAYER_ROOM_VENUE_SLUG,
    status: "approved",
    booking_date: NOV16,
    end_date: null,
    setup_time: null,
    start_time: "16:00",
    end_time: "17:15",
    setdown_time: null,
    ...over,
  });
}

function covers(c: RoomClosure | null, date: string, start: string, end: string) {
  expect(c).not.toBeNull();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return closureCovering([c!], date, sh * 60 + sm, eh * 60 + em);
}

describe("approved auditorium bookings close the prayer room", () => {
  it("blocks the 16 Nov 2026 16:00–17:15 auditorium booking across practice rows", () => {
    const c = booking();
    expect(c).toMatchObject({
      id: "auditorium:551d5dfb",
      block_date: NOV16,
      end_date: NOV16,
      start_time: "16:00",
      end_time: "17:15",
      label: AUDITORIUM_BOOKED_LABEL,
      source: "auditorium",
    });
    expect(c).not.toHaveProperty("title");
    expect(covers(c, NOV16, "16:00", "16:30")?.label).toBe(AUDITORIUM_BOOKED_LABEL);
    expect(covers(c, NOV16, "16:30", "17:00")).not.toBeNull();
    expect(covers(c, NOV16, "17:00", "17:30")).not.toBeNull();
  });

  it("treats an edge that only touches as free", () => {
    const c = booking();
    expect(covers(c, NOV16, "17:15", "17:45")).toBeNull();
    expect(covers(c, NOV16, "15:30", "16:00")).toBeNull();
  });

  it("catches a partial overlap, a slot inside the booking, and a booking inside the slot", () => {
    const c = booking();
    expect(covers(c, NOV16, "17:00", "17:45")).not.toBeNull();
    expect(covers(c, NOV16, "16:30", "17:00")).not.toBeNull();
    expect(covers(c, NOV16, "15:00", "18:00")).not.toBeNull();
    const tiny = booking({ start_time: "16:10", end_time: "16:20" });
    expect(covers(tiny, NOV16, "16:00", "16:30")).not.toBeNull();
  });

  it("extends the window by setup and set-down", () => {
    const c = booking({
      setup_time: "15:30",
      start_time: "16:00",
      end_time: "17:00",
      setdown_time: "17:30",
    });
    expect(c).toMatchObject({ start_time: "15:30", end_time: "17:30" });
    expect(covers(c, NOV16, "15:30", "16:00")).not.toBeNull();
    expect(covers(c, NOV16, "17:00", "17:30")).not.toBeNull();
    expect(covers(c, NOV16, "15:00", "15:30")).toBeNull();
    expect(covers(c, NOV16, "17:30", "18:00")).toBeNull();
  });

  it("uses the event times when setup or set-down is missing", () => {
    expect(booking({ setup_time: "15:45", setdown_time: null })).toMatchObject({
      start_time: "15:45",
      end_time: "17:15",
    });
    expect(booking({ setup_time: null, setdown_time: "17:45" })).toMatchObject({
      start_time: "16:00",
      end_time: "17:45",
    });
  });

  it("does not block pending, denied, or cancelled bookings", () => {
    for (const status of ["pending", "denied", "cancelled", "declined"]) {
      expect(booking({ status })).toBeNull();
    }
  });

  it("ignores every venue except the auditorium", () => {
    expect(booking({ venueSlug: "upstairs-space" })).toBeNull();
    expect(booking({ venueSlug: "molen-st" })).toBeNull();
  });

  it("holds a multi-day booking for the whole of each day, and not the day after", () => {
    const c = booking({
      booking_date: "2026-11-16",
      end_date: "2026-11-18",
      start_time: "16:00",
      end_time: "17:15",
    });
    expect(c).toMatchObject({ start_time: null, end_time: null, end_date: "2026-11-18" });
    expect(covers(c, "2026-11-16", "05:00", "06:00")).not.toBeNull();
    expect(covers(c, "2026-11-17", "16:00", "16:30")).not.toBeNull();
    expect(covers(c, "2026-11-18", "23:00", "23:30")).not.toBeNull();
    expect(covers(c, "2026-11-15", "16:00", "17:30")).toBeNull();
    expect(covers(c, "2026-11-19", "00:00", "01:00")).toBeNull();
  });

  it("treats a booking with no times as the whole day", () => {
    const c = booking({ start_time: null, end_time: null });
    expect(c).toMatchObject({ start_time: null, end_time: null });
    expect(covers(c, NOV16, "16:00", "16:30")).not.toBeNull();
  });
});

describe("Africa/Johannesburg date boundaries", () => {
  it("reads 22:00 UTC on the 16th as the 17th in Johannesburg", () => {
    expect(johannesburgDate(new Date("2026-11-16T22:00:00Z"))).toBe("2026-11-17");
    expect(johannesburgDate(new Date("2026-11-16T21:59:00Z"))).toBe("2026-11-16");
  });

  it("keeps a stored booking on its calendar date instead of the UTC date", () => {
    // 16:00 SAST is 14:00 UTC the same calendar day. 00:30 SAST on the 17th
    // is 22:30 UTC on the 16th — the closure stays on the 17th.
    const afternoon = booking();
    expect(covers(afternoon, "2026-11-16", "16:00", "16:30")).not.toBeNull();
    expect(covers(afternoon, "2026-11-15", "16:00", "17:30")).toBeNull();

    const afterMidnight = booking({
      id: "midnight",
      booking_date: johannesburgDate(new Date("2026-11-16T22:30:00Z")),
      start_time: "00:00",
      end_time: "00:30",
    });
    expect(afterMidnight).toMatchObject({ block_date: "2026-11-17", start_time: "00:00", end_time: "00:30" });
    expect(covers(afterMidnight, "2026-11-16", "16:00", "17:30")).toBeNull();
    expect(covers(afterMidnight, "2026-11-17", "00:00", "00:30")).not.toBeNull();
    expect(covers(afterMidnight, "2026-11-17", "00:30", "01:00")).toBeNull();
  });
});

describe("prayer room block-outs", () => {
  it("closes a timed window and leaves a touching neighbour free", () => {
    const c = blockoutClosure({
      id: "bo-1",
      block_date: NOV16,
      end_date: NOV16,
      start_time: "16:00:00",
      end_time: "17:00:00",
      reason: "Sound check",
    });
    expect(c).toMatchObject({ id: "blockout:bo-1", start_time: "16:00", end_time: "17:00", label: "Sound check" });
    expect(covers(c, NOV16, "16:30", "17:00")).not.toBeNull();
    expect(covers(c, NOV16, "17:00", "17:30")).toBeNull();
  });

  it("closes the whole day when the block-out has no times", () => {
    const c = blockoutClosure({
      id: "bo-2",
      block_date: NOV16,
      end_date: "2026-11-17",
      start_time: null,
      end_time: null,
      reason: null,
    });
    expect(c.label).toBe("Blocked");
    expect(covers(c, NOV16, "05:00", "06:00")).not.toBeNull();
    expect(covers(c, "2026-11-17", "16:00", "16:30")).not.toBeNull();
    expect(covers(c, "2026-11-18", "16:00", "16:30")).toBeNull();
  });
});
