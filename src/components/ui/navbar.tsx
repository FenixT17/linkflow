"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { ButtonLink } from "./button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const links = [
  { label: "Funcionalidades", href: "/#features" },
  { label: "Preços", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { account, isLoading } = useAuth();
  const isLoggedIn = !isLoading && !!account;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Bloqueia o scroll do body enquanto o menu mobile está aberto
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Fecha o menu com Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    },
    []
  );

  useEffect(() => {
    if (!mobileOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, handleKeyDown]);

  return (
    <>
      {/* Backdrop do menu mobile — fecha ao tocar fora.
          NOTA: fica FORA do motion.header porque a animação `filter` do header
          cria um containing block que tornaria o `fixed inset-0` relativo ao
          header (e não à viewport), partindo o dim/backdrop. */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <motion.header
        initial={{ y: -80, opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-[var(--background)] md:bg-transparent"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={[
            "flex items-center justify-between rounded-[calc(var(--glass-radius)*1.5)] px-4 sm:px-5 py-2.5",
            "transition-all duration-500",
            "glass-nav",
            scrolled && "glass-strong",
          ].join(" ")}
        >
          <Link href="/" className="flex items-center gap-2.5 group relative z-[1]">
            <Logo
              size={32}
              className="h-8 w-8 transition-transform duration-300 group-hover:scale-105 brightness-150 contrast-125"
            />
            <span className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
              LinkFlow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 relative z-[1]">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="glass-item relative px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 relative z-[1]">
            <ThemeToggle />
            {isLoggedIn ? (
              <ButtonLink href="/dashboard" size="sm">
                Dashboard
              </ButtonLink>
            ) : (
              <>
                <Link
                  href="/login"
                  className="glass-item text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2"
                >
                  Entrar
                </Link>
                <ButtonLink href="/register" size="sm">
                  Começar
                </ButtonLink>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden relative z-[1]">
            <ThemeToggle />
            <button
              className="glass-btn !h-9 !w-9 !p-0 flex items-center justify-center"
              onClick={() => setMobileOpen((p) => !p)}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-dropdown"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav-dropdown"
            initial={{ opacity: 0, y: -12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="md:hidden absolute top-full left-0 right-0 mt-2 px-4 z-50"
          >
            <div className="glass-dropdown-strong p-4 space-y-1.5 max-h-[calc(100dvh-6rem)] overflow-y-auto">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="glass-item block px-3 py-2.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {link.label}
                </a>
              ))}
              <div className="glass-divider my-2" />
              {isLoggedIn ? (
                <ButtonLink href="/dashboard" className="w-full" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </ButtonLink>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="glass-item block px-3 py-2.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    Entrar
                  </Link>
                  <ButtonLink
                    href="/register"
                    className="w-full mt-1"
                    onClick={() => setMobileOpen(false)}
                  >
                    Começar
                  </ButtonLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
    </>
  );
}
