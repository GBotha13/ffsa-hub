import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isApprovedMember, isPrayerRoomStaff } from "@/lib/auth/prayer-room-access";
import { getPracticeWeek } from "@/services/prayer-room-practice";
import { sastNow } from "@/lib/prayer-room/practice";

// GET ?week=YYYY-MM-DD — the practice week containing that date (default:
// this week, by the SAST clock rather than the server's UTC one). Readable by
// everyone signed in: names are on the wall for everyone (handoff 17, rule 13).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const week = new URL(request.url).searchParams.get("week");
  const anchor = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : sastNow().slice(0, 10);

  const [isStaff, isMember] = await Promise.all([
    isPrayerRoomStaff(supabase, user.id),
    isApprovedMember(supabase, user.id),
  ]);

  try {
    const data = await getPracticeWeek(supabase, createAdminClient(), {
      anchor,
      userId: user.id,
      // Who CAN book is decided by the database; this only stops the UI
      // offering buttons that would be refused.
      canBook: isStaff || isMember,
      isStaff,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
