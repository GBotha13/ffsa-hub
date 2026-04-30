"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Silently re-fetches all server component data on a timer.
 * Drop this anywhere in a layout to keep data fresh across all connected clients.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
