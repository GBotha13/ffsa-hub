import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookBand, bookStation, type LineupEntry } from "@/services/prayer-room-practice";
import { practiceErrorMessage } from "@/lib/prayer-room/practice";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

// POST — book a station or the whole room.
//   { kind: "station", date, start, end, stationId, singers?: uuid[] }
//   { kind: "band",    date, start, end, bandName, lineup: [{ station_id, user_id }] }
//
// Every rule — who may book, the window, 30-minute steps, 60 minutes at most,
// the Sunday opening, no clashes, bands only on empty rows — is enforced by the
// database functions this calls (migration 224). This route only checks shape.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind === "band" ? "band" : "station";
  const date = String(body.date ?? "");
  const start = String(body.start ?? "");
  const end = String(body.end ?? "");
  if (!DATE.test(date) || !TIME.test(start) || !TIME.test(end)) {
    return NextResponse.json({ error: "A date, start and end are required." }, { status: 400 });
  }

  if (kind === "station") {
    const stationId = String(body.stationId ?? "");
    if (!stationId) return NextResponse.json({ error: "Pick a station." }, { status: 400 });
    const singers = Array.isArray(body.singers) ? body.singers.map(String) : [];
    const { data, error } = await bookStation(supabase, { date, start, end, stationId, singers });
    if (error) return NextResponse.json({ error: practiceErrorMessage(error, "station") }, { status: 409 });
    return NextResponse.json({ id: data });
  }

  const bandName = String(body.bandName ?? "").trim();
  if (!bandName) return NextResponse.json({ error: "Give the band a name." }, { status: 400 });
  const lineup = (Array.isArray(body.lineup) ? body.lineup : []) as LineupEntry[];
  const { data, error } = await bookBand(supabase, { date, start, end, bandName, lineup });
  if (error) return NextResponse.json({ error: practiceErrorMessage(error, "band") }, { status: 409 });
  return NextResponse.json({ id: data });
}
