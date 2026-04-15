"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PORTAL_TABS } from "@/config/modules";

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/profile" className="text-lg font-bold tracking-tight">
          FFSA
        </Link>

        <nav className="flex items-center gap-1">
          {PORTAL_TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            className="ml-2 gap-2 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
