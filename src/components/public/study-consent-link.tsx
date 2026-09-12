"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { hasStudyConsent, setStudyConsent } from "@/lib/study-consent";

/**
 * Consentimento de dados para estudos — versão discreta no rodapé da página
 * pública (substitui o antigo cartão fixo). O painel só existe quando o
 * visitante toca no link, mantendo a página limpa.
 *
 * Hydration-safe: o estado do consentimento vive no browser (localStorage),
 * por isso só é lido depois de montar (`mounted`) — o HTML do servidor e o
 * primeiro render do cliente coincidem sempre.
 */
export function StudyConsentLink({ color }: { color?: string }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGranted(hasStudyConsent());
    const update = () => setGranted(hasStudyConsent());
    window.addEventListener("linkflow-study-consent", update);
    return () => window.removeEventListener("linkflow-study-consent", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const choose = useCallback((value: boolean) => {
    setStudyConsent(value);
    setOpen(false);
  }, []);

  return (
    <div className="relative mx-auto mt-3 w-fit">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="text-[11px] underline decoration-dotted underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
        style={{ color }}
      >
        Dados para estudos{mounted && granted ? " · aceite" : ""}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Consentimento de dados para estudos"
          className="absolute bottom-full left-1/2 z-30 mb-3 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 p-4 text-left text-xs leading-relaxed text-white/75 shadow-2xl backdrop-blur-xl"
        >
          <p>
            As métricas principais ajudam a melhorar o LinkFlow. Dados adicionais
            para estudos podem incluir IP, dispositivo e localização aproximada, e
            só serão recolhidos com o teu consentimento. Consulta a nossa{" "}
            <Link
              href="/privacidade"
              className="underline underline-offset-2 hover:text-white"
            >
              política de privacidade
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10"
              onClick={() => choose(false)}
            >
              Recusar
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-white/85"
              onClick={() => choose(true)}
            >
              Aceitar dados de estudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
