"use client";

import { useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { Globe, Plus, Check } from "lucide-react";
import { siteUrl } from "@/lib/seo";

export default function DomainsPage() {
  const [domain, setDomain] = useState("");
  const isPro = false;
  const dnsTarget = siteUrl.replace(/^https?:\/\//, "");

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
            <div className="glass-card p-4 space-y-2">
              <p className="text-xs text-white/50">Adicione os seguintes registos DNS:</p>
              {[
                { type: "CNAME", name: "@", value: dnsTarget },
                { type: "CNAME", name: "www", value: dnsTarget },
              ].map((record, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center rounded-full glass px-2 py-0.5 font-mono text-xs">{record.type}</span>
                  <span className="font-mono text-white/90">{record.name}</span>
                  <span className="text-white/40">→</span>
                  <span className="font-mono text-white/90">{record.value}</span>
                  <button className="ml-auto text-white/40 hover:text-white/80"><Check className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
