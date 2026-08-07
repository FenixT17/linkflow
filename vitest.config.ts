import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  oxc: {
    // Vitest's types do not include "automatic" yet, but the runtime supports it.
    // @ts-expect-error OXC JSX transform type mismatch in Vitest 4.
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The server-only guard is intentionally neutralized only in Vitest;
      // production builds still resolve the real package and prevent client imports.
      "server-only": path.resolve(__dirname, "./src/__tests__/server-only-shim.ts"),
    },
  },
});
