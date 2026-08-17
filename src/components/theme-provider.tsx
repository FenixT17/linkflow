"use client";

import * as React from "react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ALLOWED_THEMES,
  AllowedTheme,
  THEME_STORAGE_KEY,
  isAllowedTheme,
} from "@/lib/theme-security";

interface ThemeContextValue {
  theme: AllowedTheme;
  resolvedTheme: "light" | "dark" | "gray";
  systemTheme: "light" | "dark";
  setTheme: (theme: AllowedTheme) => void;
  themes: readonly string[];
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(defaultTheme: AllowedTheme): AllowedTheme {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAllowedTheme(raw) ? raw : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

/**
 * Provider de tema próprio (sem next-themes).
 *
 * O script inline do next-themes era minificado pelo pipeline de build com o
 * helper `__name` sem definição (ReferenceError em produção — ver
 * THEME_SCRIPT em lib/theme-security.ts). Este provider aplica o tema com o
 * mesmo contrato (useTheme: theme/resolvedTheme/systemTheme/setTheme) mas sem
 * depender de scripts inline de bibliotecas externas.
 *
 * O tema default é "dark" (igual ao defaultTheme do layout). O valor é
 * persistido em localStorage["theme"] (whitelist em lib/theme-security) e o
 * script pré-hidratação THEME_SCRIPT aplica a classe .dark no <head> antes do
 * React correr — sem flash de tema.
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode;
  defaultTheme?: AllowedTheme;
}) {
  const [theme, setThemeState] = useState<AllowedTheme>(() => readStoredTheme(defaultTheme));
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");

  // Acompanha o esquema de cor do sistema (guard para ambientes sem
  // matchMedia — ex.: jsdom nos testes).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(mq.matches ? "dark" : "light");
    setSystemTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const applyTheme = useCallback((next: AllowedTheme, system: "light" | "dark") => {
    const resolved = next === "system" ? system : next;
    const root = document.documentElement;
    // O modo escuro é o principal por defeito (defaultTheme="dark"). O modo
    // cinza é um tema escuro com fundo acinzentado — mantém a classe .dark
    // para que as variantes Tailwind `dark:` continuem a aplicar.
    const isDark = resolved === "dark" || resolved === "gray";
    root.classList.toggle("dark", isDark);
    root.classList.toggle("gray", resolved === "gray");
    root.classList.toggle("light", resolved === "light");
    root.style.colorScheme = resolved === "light" ? "light" : "dark";
  }, []);

  // Aplica sempre que o tema ou o esquema do sistema mudam (inclui 1º mount).
  useEffect(() => {
    applyTheme(theme, systemTheme);
  }, [theme, systemTheme, applyTheme]);

  // Sincronização cross-tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && isAllowedTheme(e.newValue)) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: AllowedTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage indisponível (ex.: modo privado) — o tema ainda aplica
      // nesta sessão via applyTheme.
    }
  }, []);

  const resolvedTheme: "light" | "dark" | "gray" =
    theme === "system" ? systemTheme : theme;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, systemTheme, setTheme, themes: ALLOWED_THEMES }),
    [theme, resolvedTheme, systemTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
