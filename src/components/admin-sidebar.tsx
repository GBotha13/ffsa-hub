"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ADMIN_MODULES,
  SYSTEM_MODULES,
  PORTAL_TABS,
  getAccessibleModules,
} from "@/config/modules";

interface AdminSidebarProps {
  userRoles: string[];
}

export function AdminSidebar({ userRoles }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleModules = getAccessibleModules(ADMIN_MODULES, userRoles);
  const visibleSystem = getAccessibleModules(SYSTEM_MODULES, userRoles);

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          FFSA Platform
        </Link>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleModules.map((mod) => {
          const isActive =
            pathname === mod.href || pathname.startsWith(mod.href + "/");
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <mod.icon className="h-4 w-4 shrink-0" />
              {mod.label}
            </Link>
          );
        })}

        {visibleSystem.length > 0 && (
          <>
            <Separator className="my-2" />
            {visibleSystem.map((mod) => {
              const isActive =
                pathname === mod.href || pathname.startsWith(mod.href + "/");
              return (
                <Link
                  key={mod.id}
                  href={mod.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <mod.icon className="h-4 w-4 shrink-0" />
                  {mod.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <Separator />

      {/* Personal portal links */}
      <div className="px-3 py-3">
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Personal
        </p>
        <div className="space-y-1">
          {PORTAL_TABS.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
