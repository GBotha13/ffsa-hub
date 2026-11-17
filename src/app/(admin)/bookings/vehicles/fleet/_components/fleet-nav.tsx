"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { FLEET } from "./ui";

// The Fleet tab strip, in the order the co-ordinator works. Today, Calendar and
// Schedule arrive with PR 3 (vehicles-module/HUB-PLAN.md).
const TABS = [
  { href: `${FLEET}/vehicles`, label: "Vehicles", match: (p: string) => p === `${FLEET}/vehicles` || /^\/bookings\/vehicles\/fleet\/[0-9a-f-]{36}/.test(p) || p.startsWith(`${FLEET}/inspections`) },
  { href: `${FLEET}/workshops`, label: "Workshops" },
  { href: `${FLEET}/checklist`, label: "Checklist" },
  { href: `${FLEET}/guide`, label: "Guide" },
  { href: `${FLEET}/settings`, label: "Settings" },
];

export function FleetNav() {
  const path = usePathname() || "";
  return (
    <nav aria-label="Fleet" className="flex flex-wrap items-end border-b border-ink px-5 pt-3 md:px-8">
      {TABS.map((t) => {
        const on = t.match ? t.match(path) : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center px-3.5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
              on ? "bg-ink text-white" : "text-[#7C786C] hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
