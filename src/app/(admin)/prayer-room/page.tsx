import { createClient } from "@/lib/supabase/server";
import { isPrayerRoomStaff } from "@/lib/auth/prayer-room-access";
import { getPendingApplicationCount } from "@/services/prayer-room";
import { getMemberFlags } from "@/services/prayer-room-members";
import PrayerRoomClient from "./prayer-room-client";

export default async function PrayerRoomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [isStaff, memberRes] = await Promise.all([
    isPrayerRoomStaff(supabase, user.id),
    getMemberFlags(supabase, user.id),
  ]);

  const member = memberRes.data as
    | { status: string; is_evaluator: boolean; is_coordinator: boolean }
    | null;
  const isMember = member?.status === "active";
  const isEvaluator = !!member?.is_evaluator;

  const pendingCount = isStaff ? await getPendingApplicationCount(supabase) : 0;

  return (
    <PrayerRoomClient
      userId={user.id}
      isStaff={isStaff}
      isMember={isMember}
      isEvaluator={isEvaluator}
      pendingCount={pendingCount}
    />
  );
}
