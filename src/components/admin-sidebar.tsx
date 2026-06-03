"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { LogOut, Menu } from "lucide-react";
import Image from "next/image";
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
  permittedModules?: Set<string>;
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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? ""
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}
      style={
        isActive
          ? {
              background: "hsl(42 95% 55% / 0.12)",
              color: "hsl(42 95% 60%)",
              borderLeft: "2px solid hsl(42 95% 55%)",
              paddingLeft: "calc(0.75rem - 2px)",
            }
          : undefined
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span style={{ letterSpacing: "0.01em" }}>{label}</span>
    </Link>
  );
}

function SidebarLogo({ compact = false }: { compact?: boolean }) {
  const width = compact ? 120 : 150;
  return (
    <Link href="/dashboard" className="block group">
      <Image
        src="/brand/ff-wordmark-white.png"
        alt="Fire & Fragrance"
        width={width}
        height={Math.round(width * 0.1185)}
        style={{ objectFit: "contain", objectPosition: "left", display: "block" }}
        priority
      />
      <div className="flex items-center gap-1.5 mt-2">
        <div style={{ height: "1px", width: "12px", background: "hsl(42 95% 55%)" }} />
        <span
          style={{
            fontSize: "8px",
            letterSpacing: "0.32em",
            fontWeight: 700,
            color: "hsl(42 95% 55%)",
            textTransform: "uppercase",
          }}
        >
          South Africa · Hub
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

export function AdminSidebar({ userRoles, permittedModules }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleModules = getAccessibleModules(ADMIN_MODULES, userRoles, permittedModules);
  const visibleSystem = getAccessibleModules(SYSTEM_MODULES, userRoles, permittedModules);

  const sidebarStyle = {
    background: "#0D0B09",
    borderRight: "1px solid hsl(22 8% 12%)",
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
        <SidebarLogo compact />
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
