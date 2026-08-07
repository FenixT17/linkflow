/**
 * LinkFlow — Segurança do sistema de temas (prevenção de DOM XSS).
 *
 * CWE-79 / OWASP A05:2025 — o scanner detectou que o valor de
 * `localStorage["theme"]` chega a um sink de DOM mutation (o script
 * inline do next-themes lê o valor cru e aplica-o diretamente em
 * `classList.add()` no <html>) sem validação suficiente.
 *
 * Este módulo centraliza a validação do tema:
 *  - whitelist estrita: apenas "light" | "dark" | "system";
 *  - `getSafeTheme()` devolve sempre um valor da whitelist;
 *  - script de sanitização que corre ANTES do script do next-themes
 *    para nunca deixar um valor inválido chegar ao DOM.
 */

export const ALLOWED_THEMES = ["light", "dark", "system"] as const;

export type AllowedTheme = (typeof ALLOWED_THEMES)[number];

export const THEME_STORAGE_KEY = "theme";

export const FALLBACK_THEME: AllowedTheme = "system";

export function isAllowedTheme(value: unknown): value is AllowedTheme {
  return (
    typeof value === "string" &&
    (ALLOWED_THEMES as readonly string[]).includes(value)
  );
}

/**
 * Lê um valor vindo do localStorage e devolve apenas um valor da whitelist.
 * Qualquer valor inválido (ou ausente) é descartado e substituído por "system".
 */
export function getSafeTheme(raw: unknown): AllowedTheme {
  return isAllowedTheme(raw) ? raw : FALLBACK_THEME;
}

/**
 * Lê `localStorage["theme"]` de forma segura (try/catch) e devolve
 * apenas um valor da whitelist. Nunca expõe o valor cru.
 */
export function getSafeThemeFromStorage(): AllowedTheme {
  if (typeof window === "undefined") return FALLBACK_THEME;
  try {
    return getSafeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return FALLBACK_THEME;
  }
}

/**
 * Corrige um valor inválido já gravado em localStorage["theme"],
 * substituindo-o por "system" (limpeza de XSS persistente).
 */
export function sanitizeStoredTheme(): AllowedTheme {
  const safe = getSafeThemeFromStorage();
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw !== null && !isAllowedTheme(raw)) {
        window.localStorage.setItem(THEME_STORAGE_KEY, safe);
      }
    }
  } catch {
    // localStorage indisponível (ex.: modo privado) — nada a corrigir
  }
  return safe;
}

/**
 * Script de sanitização pré-hidratação.
 *
 * Corre no <head> ANTES do script inline do next-themes (que lê
 * localStorage["theme"] e o aplica diretamente ao DOM). Garante que:
 *  - valores inválidos armazenados sejam substituídos por "system";
 *  - o valor que o next-themes vai ler já está validado pela whitelist;
 *  - eventos de storage cross-tab com valores inválidos sejam corrigidos.
 *
 * Não usa nenhuma API React/Next — JS puro, sem dependências.
 */
/**
 * Script de aplicação de tema pré-hidratação (substitui o script inline do
 * next-themes).
 *
 * O script do next-themes era minificado pelo pipeline de build com o helper
 * esbuild `__name` sem a definição do helper ("ReferenceError: __name is not
 * defined" no <head> de todas as páginas em produção), o que quebrava a
 * aplicação do tema antes da hidratação. Este script é uma string pura no
 * bundle (como o sanitizador) — nunca é transformado pelo minificador, por
 * isso não pode voltar a partir. Aplica o tema (dark por defeito, igual ao
 * defaultTheme="dark" do layout) e acompanha mudanças de sistema/cross-tab.
 */
export const THEME_SCRIPT = `(function () {
  var ALLOWED = ["light", "dark", "system"];
  var KEY = "theme";
  var FALLBACK = "dark";
  function isAllowed(v) {
    return typeof v === "string" && ALLOWED.indexOf(v) !== -1;
  }
  function current() {
    var raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (e) {}
    return isAllowed(raw) ? raw : FALLBACK;
  }
  function apply(t) {
    var dark =
      t === "dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }
  apply(current());
  try {
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) apply(current());
    });
  } catch (e) {}
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (current() === "system") apply("system");
    });
  } catch (e) {}
})();`;

export const THEME_SANITIZER_SCRIPT = `(function () {
  var ALLOWED = ["light", "dark", "system"];
  var KEY = "theme";
  var FALLBACK = "system";
  function isAllowed(v) {
    return typeof v === "string" && ALLOWED.indexOf(v) !== -1;
  }
  function sanitize() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw !== null && !isAllowed(raw)) {
        window.localStorage.setItem(KEY, FALLBACK);
      }
    } catch (e) {}
  }
  // Impede que um valor inválido seja sequer gravado (XSS persistente).
  // Fecha também o vetor cross-tab: o listener do next-themes lê
  // event.newValue cru, por isso garantimos que valores inválidos
  // nunca chegam a ser persistidos no localStorage["theme"].
  function guard() {
    try {
      var orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === KEY && !isAllowed(v)) {
          v = FALLBACK;
        }
        return orig.call(this, k, v);
      };
    } catch (e) {}
  }
  guard();
  sanitize();
  try {
    window.addEventListener("storage", function (e) {
      if (e.key === KEY && e.newValue !== null && !isAllowed(e.newValue)) {
        window.localStorage.setItem(KEY, FALLBACK);
      }
    });
  } catch (e) {}
})();`;
