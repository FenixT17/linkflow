"use client";

import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Contrast } from "lucide-react";
import { useEffect, useState } from "react";
import { getSafeTheme } from "@/lib/theme-security";

type ToggleTheme = "light" | "dark" | "gray";

// Ciclo do botão: escuro → cinza → claro → escuro (o escuro é o principal).
const NEXT_THEME: Record<ToggleTheme, ToggleTheme> = {
  dark: "gray",
  gray: "light",
  light: "dark",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={["h-9 w-9", className].filter(Boolean).join(" ")} />;

  // Tema efetivo: se o utilizador escolheu "system", usa o tema resolvido.
  const safe = getSafeTheme(theme);
  const current: ToggleTheme =
    safe === "system" ? (resolvedTheme === "gray" ? "gray" : resolvedTheme) : safe;
  const next = NEXT_THEME[current];

  const Icon = current === "dark" ? Moon : current === "gray" ? Contrast : Sun;
  const label =
    current === "dark"
      ? "Tema escuro — muda para cinza"
      : current === "gray"
        ? "Tema cinza — muda para claro"
        : "Tema claro — muda para escuro";

  return (
    <button
      onClick={() => setTheme(next)}
      className={[
        "glass-btn inline-flex h-9 w-9 items-center justify-center !p-0",
        "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4 relative z-[1]" />
    </button>
  );
}
