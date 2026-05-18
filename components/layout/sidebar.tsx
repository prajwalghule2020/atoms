"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Share2,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",      href: "/dashboard",         icon: LayoutDashboard, roles: ["EMPLOYEE"] },
  { label: "My Goals",       href: "/dashboard/goals",   icon: Target,          roles: ["EMPLOYEE"] },
  { label: "Check-ins",      href: "/dashboard/checkins",icon: CheckSquare,     roles: ["EMPLOYEE"] },
  { label: "Team Dashboard", href: "/manager/dashboard", icon: LayoutDashboard, roles: ["MANAGER"] },
  { label: "Approvals",      href: "/manager/approvals", icon: CheckSquare,     roles: ["MANAGER"] },
  { label: "Check-ins",      href: "/manager/checkins",  icon: ClipboardList,   roles: ["MANAGER"] },
  { label: "Dashboard",      href: "/admin/dashboard",   icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "Users & Org",    href: "/admin/users",       icon: Users,           roles: ["ADMIN"] },
  { label: "Cycles",         href: "/admin/cycles",      icon: Settings,        roles: ["ADMIN"] },
  { label: "Share Goals",    href: "/admin/goals/share", icon: Share2,          roles: ["ADMIN"] },
  { label: "Reports",        href: "/admin/reports",     icon: BarChart3,       roles: ["ADMIN"] },
  { label: "Audit Trail",    href: "/admin/audit",       icon: ShieldCheck,     roles: ["ADMIN"] },
];

interface SidebarProps {
  user: { name: string; email: string; role: Role };
}

// ── Mobile hamburger trigger (rendered in header) ─────────────────────────────
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={onClick}>
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle menu</span>
    </Button>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [collapsed, setCollapsed] = useState(false); // desktop collapse
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer
  const [pendingCount, setPendingCount] = useState(0);

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Fetch pending approvals badge
  useEffect(() => {
    if (user.role !== "MANAGER") return;
    apiFetch<{ id: string }[]>("/api/manager/approvals")
      .then((s) => setPendingCount(s.length))
      .catch(() => {});
  }, [user.role]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className={cn(
        "flex h-16 items-center border-b shrink-0",
        collapsed && !mobile ? "justify-center px-3" : "justify-between px-4"
      )}>
        <div className={cn("flex items-center gap-3", collapsed && !mobile && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Target className="h-4 w-4" />
          </div>
          {(!collapsed || mobile) && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold leading-none">AtomQuest</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user.role === "ADMIN" ? "Admin Portal" : user.role === "MANAGER" ? "Manager Portal" : "My Portal"}
              </p>
            </div>
          )}
        </div>
        {mobile && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 shrink-0 rounded-full border", collapsed && "mx-auto mt-0")}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isApprovals = item.href === "/manager/approvals";
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  collapsed && !mobile ? "justify-center px-0 py-2.5 w-full" : "",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {(!collapsed || mobile) && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {isApprovals && pendingCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold px-1">
                        {pendingCount > 9 ? "9+" : pendingCount}
                      </span>
                    )}
                  </>
                )}
                {collapsed && !mobile && isApprovals && pendingCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-destructive" />
                )}
              </Link>
            );

            if (collapsed && !mobile) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <div className="relative flex justify-center">{link}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                    {isApprovals && pendingCount > 0 && ` (${pendingCount})`}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{link}</div>;
          })}
        </TooltipProvider>
      </nav>

      <Separator />

      {/* User footer */}
      <div className={cn(
        "flex items-center gap-3 p-3",
        collapsed && !mobile ? "justify-center flex-col py-4" : ""
      )}>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {(!collapsed || mobile) && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen border-r bg-card transition-all duration-300 ease-in-out shrink-0",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile: Backdrop ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: Drawer ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-card border-r shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent mobile />
      </aside>

      {/* ── Mobile trigger exposed via context ──────────────────────────── */}
      {/* We attach the trigger to the header via a global event */}
      <button
        id="mobile-menu-trigger"
        className="hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle mobile menu"
      />
    </>
  );
}

// Hook for header to open the mobile sidebar
export function useMobileSidebar() {
  const openSidebar = () => {
    document.getElementById("mobile-menu-trigger")?.click();
  };
  return { openSidebar };
}
