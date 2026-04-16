"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  ADMIN_MODULES,
  SYSTEM_MODULES,
  PORTAL_TABS,
  getAccessibleModules,
} from "@/config/modules";

interface AdminSidebarProps {
  userRoles: string[];
}

function NavLink({
  href,
  isActive,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  isActive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      style={
        isActive
          ? {
              background: "hsl(42 95% 55%)",
              boxShadow: "0 0 14px rgba(245,197,24,0.2)",
            }
          : undefined
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarLogo() {
  return (
    <Link href="/dashboard" className="block">
      <div
        className="text-foreground leading-none"
        style={{
          fontFamily: "var(--font-bebas, 'Bebas Neue', 'Arial Black', sans-serif)",
          fontSize: "21px",
          letterSpacing: "0.07em",
        }}
      >
        FIRE &amp; FRAGRANCE
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span
          className="text-muted-foreground/60 uppercase tracking-widest"
          style={{ fontSize: "9px", letterSpacing: "0.22em", fontWeight: 600 }}
        >
          SOUTH AFRICA
        </span>
        <span
          className="font-bold rounded"
          style={{
            background: "hsl(42 95% 55%)",
            color: "hsl(0 0% 5%)",
            fontSize: "8px",
            letterSpacing: "0.1em",
            padding: "1px 5px",
          }}
        >
          HUB
        </span>
      </div>
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="px-3 pb-1"
      style={{
        fontSize: "9px",
        letterSpacing: "0.2em",
        fontWeight: 600,
        color: "hsl(30 8% 38%)",
        textTransform: "uppercase",
      }}
    >
      {label}
    </p>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "hsl(22 8% 12%)" }} />;
}

function NavContent({
  visibleModules,
  visibleSystem,
  pathname,
  onNavClick,
  onSignOut,
}: {
  visibleModules: typeof ADMIN_MODULES;
  visibleSystem: typeof SYSTEM_MODULES;
  pathname: string;
  onNavClick?: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleModules.map((mod) => {
          const isActive = pathname === mod.href || pathname.startsWith(mod.href + "/");
          return (
            <NavLink
              key={mod.id}
              href={mod.href}
              isActive={isActive}
              icon={mod.icon}
              label={mod.label}
              onClick={onNavClick}
            />
          );
        })}

        {visibleSystem.length > 0 && (
          <>
            <div style={{ height: "1px", background: "hsl(22 8% 12%)", margin: "10px 0" }} />
            <SectionLabel label="System" />
            {visibleSystem.map((mod) => {
              const isActive = pathname === mod.href || pathname.startsWith(mod.href + "/");
              return (
                <NavLink
                  key={mod.id}
                  href={mod.href}
                  isActive={isActive}
                  icon={mod.icon}
                  label={mod.label}
                  onClick={onNavClick}
                />
              );
            })}
          </>
        )}
      </nav>

      <Divider />
      <div className="px-3 py-3">
        <SectionLabel label="Personal" />
        <div className="space-y-0.5">
          {PORTAL_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <NavLink
                key={tab.id}
                href={tab.href}
                isActive={isActive}
                icon={tab.icon}
                label={tab.label}
                onClick={onNavClick}
              />
            );
          })}
        </div>
      </div>

      <Divider />
      <div className="px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );
}

export function AdminSidebar({ userRoles }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleModules = getAccessibleModules(ADMIN_MODULES, userRoles);
  const visibleSystem = getAccessibleModules(SYSTEM_MODULES, userRoles);

  const sidebarStyle = {
    background: "hsl(20 14% 5%)",
    borderRight: "1px solid hsl(22 8% 13%)",
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex h-screen w-60 flex-col shrink-0" style={sidebarStyle}>
        <div className="px-5 pt-6 pb-5">
          <SidebarLogo />
        </div>
        <Divider />
        <NavContent
          visibleModules={visibleModules}
          visibleSystem={visibleSystem}
          pathname={pathname}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
        style={{
          background: "hsl(20 14% 5%)",
          borderBottom: "1px solid hsl(22 8% 13%)",
        }}
      >
        <SidebarLogo />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-accent p-2"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Mobile drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 border-r-0"
          style={sidebarStyle}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="px-5 pt-6 pb-5">
            <SidebarLogo />
          </div>
          <Divider />
          <div className="flex flex-col h-[calc(100%-80px)]">
            <NavContent
              visibleModules={visibleModules}
              visibleSystem={visibleSystem}
              pathname={pathname}
              onNavClick={() => setMobileOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
