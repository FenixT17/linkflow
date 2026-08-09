"use client";

import { useEffect, useState } from "react";
import { hasStudyConsent, setStudyConsent } from "@/lib/study-consent";

export function PrivacyConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(!hasStudyConsent());
    update();
    window.addEventListener("linkflow-study-consent", update);
    return () => window.removeEventListener("linkflow-study-consent", update);
  }, []);

  if (!visible) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-xl rounded-2xl border border-white/10 bg-black/80 p-4 text-sm text-white/75 shadow-2xl backdrop-blur-xl"
      aria-label="Aviso de privacidade"
    >
      <p className="leading-relaxed">
        As métricas principais ajudam a melhorar o LinkFlow. Dados adicionais para estudos podem incluir IP, dispositivo e localização aproximada, e só serão recolhidos com o teu consentimento. Consulta a nossa <a href="/privacidade" className="underline underline-offset-2 hover:text-white">política de privacidade</a>.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10"
          onClick={() => { setStudyConsent(false); setVisible(false); }}
        >
          Recusar
        </button>
        <button
          type="button"
          className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-white/85"
          onClick={() => { setStudyConsent(true); setVisible(false); }}
        >
          Aceitar dados de estudo
        </button>
      </div>
    </aside>
  );
}
