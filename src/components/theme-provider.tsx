"use client";

import * as React from "react";
import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  ALLOWED_THEMES,
  THEME_STORAGE_KEY,
  sanitizeStoredTheme,
} from "@/lib/theme-security";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  // Defesa em profundidade: após a hidratação, garante que qualquer valor
  // inválido remanescente em localStorage["theme"] seja corrigido para
  // "system" (a sanitização pré-hidratação já corre no <head>).
  useEffect(() => {
    sanitizeStoredTheme();
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
      themes={[...ALLOWED_THEMES]}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
