import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /unsubscribe is now an alias for /preferences — the preferences page is the
// unified checkbox UI. Keeping the route around so legacy footer links still
// land on the right place.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const query = t ? `?t=${encodeURIComponent(t)}` : "";
  redirect(`/preferences${query}`);
}
