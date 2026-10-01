import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPrayerRoomStaff } from "@/lib/auth/prayer-room-access";
import { getMovePlan, moveAndBookBand, type LineupEntry } from "@/services/prayer-room-practice";
import { practiceErrorMessage } from "@/lib/prayer-room/practice";

/**
 * Making room for a band — frame 36d. Admins only, and a reason is required.
 *
 * Both are checked twice on purpose: here, so nobody else gets as far as the
 * database, and again inside practice_move_plan() / practice_move_and_book_band(),
 * so the rule holds for any caller that skips this route.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

async function gate() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (!(await isPrayerRoomStaff(supabase, user.id))) {
    return { supabase, res: NextResponse.json({ error: "Only an admin can move people." }, { status: 403 }) };
  }
  return { supabase, res: null };
}

// GET ?date&start&end&reason — who loses what, and the message each gets.
export async function GET(request: Request) {
  const { supabase, res } = await gate();
  if (res) return res;

  const sp = new URL(request.url).searchParams;
  const date = sp.get("date") ?? "";
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  if (!DATE.test(date) || !TIME.test(start) || !TIME.test(end)) {
    return NextResponse.json({ error: "A date, start and end are required." }, { status: 400 });
  }
  const { data, error } = await getMovePlan(supabase, { date, start, end, reason: sp.get("reason") ?? "" });
  if (error) return NextResponse.json({ error: practiceErrorMessage(error) }, { status: 403 });
  return NextResponse.json(data ?? []);
}

// POST { date, start, end, bandName, lineup, reason } — move them and book the band.
export async function POST(request: Request) {
  const { supabase, res } = await gate();
  if (res) return res;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = String(body.date ?? "");
  const start = String(body.start ?? "");
  const end = String(body.end ?? "");
  const reason = String(body.reason ?? "").trim();
  const bandName = String(body.bandName ?? "").trim();
  if (!DATE.test(date) || !TIME.test(start) || !TIME.test(end)) {
    return NextResponse.json({ error: "A date, start and end are required." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Give a reason. Everyone you move is told it." }, { status: 400 });
  }
  if (!bandName) return NextResponse.json({ error: "Give the band a name." }, { status: 400 });

  const lineup = (Array.isArray(body.lineup) ? body.lineup : []) as LineupEntry[];
  const { data, error } = await moveAndBookBand(supabase, { date, start, end, bandName, lineup, reason });
  if (error) return NextResponse.json({ error: practiceErrorMessage(error, "band") }, { status: 409 });
  return NextResponse.json({ id: data });
}
