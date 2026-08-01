"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getSafeTheme } from "@/lib/theme-security";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={["h-9 w-9", className].filter(Boolean).join(" ")} />;

  // Apenas valores da whitelist controlam a UI (defesa em profundidade).
  const isDark = getSafeTheme(resolvedTheme) === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "glass-btn inline-flex h-9 w-9 items-center justify-center !p-0",
        "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4 relative z-[1]" /> : <Moon className="h-4 w-4 relative z-[1]" />}
    </button>
  );
}
