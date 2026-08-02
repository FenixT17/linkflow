"use client";

import { useState, useRef, useEffect } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { Globe, Plus, Check, Copy, Info } from "lucide-react";
import { siteUrl } from "@/lib/seo";

export default function DomainsPage() {
  const [domain, setDomain] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPro = false;
  const dnsTarget = siteUrl.replace(/^https?:\/\//, "");

  const records = [
    {
      type: "CNAME",
      name: "@",
      value: dnsTarget,
      hint: "Aponte o domínio raiz (ex.: exemplo.com) para o seu LinkFlow.",
    },
    {
      type: "CNAME",
      name: "www",
      value: dnsTarget,
      hint: "Aponte o subdomínio www para o seu LinkFlow.",
    },
  ];

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const flashCopied = (index: number) => {
    setCopiedIndex(index);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedIndex(null), 1600);
  };

  const copyRecord = async (value: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(index);
    } catch {
      // Fallback para browsers sem permissão de clipboard
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        const ok = document.execCommand("copy");
        if (ok) flashCopied(index);
      } catch {
        // Clipboard indisponível — ignora silenciosamente
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Domínio</h1>
        <p className="mt-1 text-sm text-white/50">Use o seu próprio domínio para a sua página.</p>
      </div>

      <div className="glass-card p-4 border-cyan-500/20 bg-cyan-500/5">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3">
          <Globe className="h-5 w-5 text-cyan-400 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-cyan-200">Domínios Personalizados</p>
              <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                Em breve
              </span>
            </div>
            <p className="text-xs text-cyan-200/70">
              A funcionalidade de domínios próprios está em desenvolvimento e estará disponível em breve para utilizadores Pro e Business.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white/90">Domínio personalizado</h2>
            <p className="text-sm text-white/50 mt-1">Adicione um domínio que possui.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="exemplo.com"
                disabled={!isPro}
                className="glass-input w-full pl-10 pr-4 py-2.5 text-sm disabled:opacity-50"
              />
            </div>
            <GlassButton disabled={!isPro}>
              <Plus className="h-4 w-4" /> Adicionar
            </GlassButton>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white/80">Domínios adicionados</h4>
            <div className="text-center py-8 text-white/40 text-sm">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum domínio adicionado.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white/80">Configuração DNS</h4>
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                <Info className="h-3.5 w-3.5 text-white/40 mt-0.5 shrink-0" />
                <p className="text-xs text-white/50">
                  No seu fornecedor de DNS (Cloudflare, GoDaddy, etc.), adicione os registos abaixo e aponte-os para{" "}
                  <span className="font-mono text-cyan-300/80">{dnsTarget}</span>.
                </p>
              </div>

              {records.map((record, i) => (
                <div
                  key={`${record.type}-${record.name}-${i}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 sm:p-4 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                      <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300 ring-1 ring-cyan-500/20 shrink-0">
                        {record.type}
                      </span>
                      <span className="font-mono text-white/90 shrink-0">{record.name}</span>
                      <span className="text-white/40 shrink-0" aria-hidden="true">→</span>
                      <span className="font-mono text-white/90 break-all min-w-0">{record.value}</span>
                    </div>
                    <button
                      onClick={() => copyRecord(record.value, i)}
                      aria-label={copiedIndex === i ? `Copiado: ${record.type} ${record.name}` : `Copiar ${record.type} ${record.name}`}
                      aria-live="polite"
                      title="Copiar valor"
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                        copiedIndex === i
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                          : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white/90 active:scale-95"
                      }`}
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">{record.hint}</p>
                </div>
              ))}

              <p className="text-[11px] text-white/30">
                💡 Nem todos os fornecedores suportam CNAME no registo raiz (&quot;@&quot;) — nesse caso, use registos A ou a
                funcionalidade de CNAME flattening do seu fornecedor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
