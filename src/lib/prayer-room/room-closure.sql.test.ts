import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * There is no pgTAP harness and no local Supabase stack in this repo, so the
 * function cannot be executed here. These assertions pin the SQL to the same
 * rules the TypeScript overlap tests cover: approved auditorium only, setup
 * and set-down widen the window, touching is not an overlap, block-outs close
 * practice, a failed read rejects the booking, and the definer function does
 * not hand booking titles back.
 */

const MIGRATIONS = path.join(process.cwd(), "supabase/migrations");
const FILE = "316_prayer_room_auditorium_blocks_practice.sql";

function migrationNumber(name: string): number {
  return parseInt(name.split("_")[0] ?? "", 10);
}

describe("migration 316", () => {
  const sql = readFileSync(path.join(MIGRATIONS, FILE), "utf8");

  it("is numbered after every other migration", () => {
    const numbers = readdirSync(MIGRATIONS)
      .filter((name) => /^\d+_/.test(name))
      .map(migrationNumber);
    expect(Math.max(...numbers)).toBe(316);
    expect(numbers.filter((n) => n === 316)).toEqual([316]);
  });

  it("checks the room from the existing trigger without changing book signatures", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.practice_validate_booking\(\)/);
    expect(sql).toMatch(/PERFORM public\.practice_assert_room_open\(NEW\.practice_date, NEW\.start_time, NEW\.end_time\)/);
    expect(sql).not.toMatch(/DROP FUNCTION[\s\S]*practice_book_station/);
    expect(sql).not.toMatch(/practice_book_station\(/);
  });

  it("is security definer, pins search_path, and is not executable by anon", () => {
    expect(sql).toMatch(
      /FUNCTION public\.practice_assert_room_open\(p_date date, p_start time, p_end time\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public/
    );
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.practice_assert_room_open\(date, time, time\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.practice_assert_room_open\(date, time, time\) TO authenticated/);
  });

  it("blocks only an approved auditorium booking, including setup and set-down", () => {
    expect(sql).toMatch(/v\.slug = 'auditorium'/);
    expect(sql).toMatch(/b\.status = 'approved'/);
    expect(sql).toMatch(/COALESCE\(b\.setup_time, b\.start_time\) < p_end/);
    expect(sql).toMatch(/p_start < GREATEST\(\s*COALESCE\(b\.setdown_time, b\.end_time\)/);
    expect(sql).not.toMatch(/COALESCE\(b\.setup_time, b\.start_time\) <= p_end/);
    expect(sql).not.toMatch(/p_start <= GREATEST/);
  });

  it("also closes practice for a block-out, with the same strict edge", () => {
    expect(sql).toMatch(/FROM public\.prayer_room_blockouts o/);
    expect(sql).toMatch(/o\.start_time < p_end AND p_start < o\.end_time/);
  });

  it("fails closed and never selects a booking title", () => {
    expect(sql).toMatch(/EXCEPTION\s+WHEN OTHERS THEN\s+RAISE EXCEPTION 'The prayer room could not be checked against Auditorium bookings/);
    expect(sql).toMatch(/The Auditorium is booked then, so practice is closed\./);
    expect(sql).not.toMatch(/\btitle\b/i);
    expect(sql).not.toMatch(/requester_name|point_person|description/);
  });
});
