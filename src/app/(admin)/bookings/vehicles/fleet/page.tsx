import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFleetAccess } from "@/services/fleet";

// Fleet's landing page. Until Today arrives (PR 3) it opens the vehicles; people who
// only manage the bookable vehicle list (no Fleet access) land on Settings, which is
// where "Manage fleet" lives now.
export default async function FleetHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const access = await getFleetAccess(supabase, user.id);
  redirect(access.canView ? "/bookings/vehicles/fleet/vehicles" : "/bookings/vehicles/fleet/settings");
}
