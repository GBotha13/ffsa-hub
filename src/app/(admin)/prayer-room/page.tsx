import { createClient } from "@/lib/supabase/server";
import PrayerRoomClient from "./prayer-room-client";

export default async function PrayerRoomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Check if user has prayer_room_admin role
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id);

  const userRoles: string[] = (roleRows ?? []).flatMap((r: Record<string, unknown>) => {
    const role = r.roles as { name: string } | null;
    return role ? [role.name] : [];
  });

  const isAdmin =
    userRoles.includes("super_admin") ||
    userRoles.includes("admin") ||
    userRoles.includes("prayer_room_admin");

  return <PrayerRoomClient userId={user.id} isAdmin={isAdmin} />;
}
