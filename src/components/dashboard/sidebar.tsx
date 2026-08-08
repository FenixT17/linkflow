"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  User,
  Link2,
  QrCode,
  LayoutGrid,
  Award,
  BarChart3,
  Globe,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Perfil", href: "/dashboard/profile", icon: User },
  { label: "Links", href: "/dashboard/links", icon: Link2 },
  { label: "Código QR", href: "/dashboard/qrcode", icon: QrCode },
  { label: "Páginas", href: "/dashboard/pages", icon: LayoutGrid },
  { label: "Badges", href: "/dashboard/badges", icon: Award },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Domínio", href: "/dashboard/domains", icon: Globe },
  { label: "Faturação", href: "/dashboard/billing", icon: CreditCard },
  { label: "Definições", href: "/dashboard/settings", icon: Settings },
];

export const nav = navItems;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { account, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--sidebar-width",
        collapsed ? "4rem" : "15rem"
      );
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Bloqueia o scroll do body enquanto o drawer mobile está aberto
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Fecha o drawer com Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const navContent = (
    <nav aria-label="Navegação principal" className="flex-1 overflow-auto py-3 px-2">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "glass-item-active bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-white" : "text-white/40 group-hover:text-white/70"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Navegação desktop"
        className={cn(
          "hidden lg:flex fixed top-0 left-0 z-40 h-screen flex-col border-r border-white/[0.06] bg-[#030303]/90 backdrop-blur-xl transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-white/[0.06]",
            collapsed ? "justify-center px-2" : "px-4 gap-3"
          )}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} className="brightness-150 contrast-125 shrink-0" />
            {!collapsed && (
              <span className="text-lg font-semibold tracking-tight text-white/90">
                LinkFlow
              </span>
            )}
          </Link>
        </div>

        {navContent}

        <div className="border-t border-white/[0.06] p-2 space-y-2">
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center" : "gap-2 px-2"
            )}
          >
            <ThemeToggle
              className={cn(
                "!h-9 !w-9 !p-0",
                collapsed ? "justify-center" : "justify-center"
              )}
            />
            {!collapsed && (
              <span className="text-xs text-white/40">Tema</span>
            )}
          </div>

          <div
            className={cn(
              "flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 border border-white/[0.06]",
              collapsed && "justify-center px-0"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-medium text-white/80">
              {account?.displayName?.charAt(0) || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-white/90">
                  {account?.displayName ?? "Utilizador"}
                </p>
                <p className="text-xs text-white/40 truncate">
                  {account?.email ?? ""}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/80",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-[4.5rem] flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-[#0a0a0a] text-white/50 hover:text-white/80 transition-colors"
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>

      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-white/[0.06] bg-[#030303]/90 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Logo size={26} className="brightness-150 contrast-125" />
            <span className="text-base font-semibold text-white/90">LinkFlow</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08]"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-drawer"
          >
            <Menu className="h-5 w-5 text-white/70" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              id="mobile-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#030303] border-r border-white/[0.06] flex flex-col"
            >
              <div
                className="flex items-center justify-between border-b border-white/[0.06]"
                style={{ paddingTop: "env(safe-area-inset-top, 0px)", height: "calc(4rem + env(safe-area-inset-top, 0px))" }}
              >
                <div className="flex items-center gap-2.5 px-5">
                  <Logo size={28} className="brightness-150 contrast-125" />
                  <span className="text-lg font-semibold text-white/90">LinkFlow</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                  className="p-2 text-white/60 hover:text-white mr-3"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-auto py-4 px-3">
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
                            active
                              ? "glass-item-active bg-white/[0.08] text-white"
                              : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-[18px] w-[18px]",
                              active ? "text-white" : "text-white/40"
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {active && <ChevronRight className="h-4 w-4 text-white/60" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="border-t border-white/[0.06] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  Sair
                </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );
}
