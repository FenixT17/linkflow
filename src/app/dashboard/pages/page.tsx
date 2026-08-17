"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { TemplateThumbnail } from "@/components/dashboard/template-thumbnail";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  PAGE_TEMPLATES,
  PAGE_TEMPLATE_BY_ID,
  DEFAULT_PAGE_TEMPLATE,
  isPageTemplate,
} from "@/lib/page-templates";
import { cn } from "@/lib/utils";
import type { PageTemplateId } from "@/lib/types";

export default function PagesPage() {
  const router = useRouter();
  const { page, idPagina, updatePage } = useAuth();
  const { showToast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);

  // Utilizador sem página → criar primeiro (mesmo padrão da Aparência).
  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  // Template atual (valida contra a whitelist — nunca valores inválidos)
  const current: PageTemplateId = isPageTemplate(page?.modeloPagina)
    ? page.modeloPagina
    : DEFAULT_PAGE_TEMPLATE;

  if (!page) {
    return null;
  }

  const handleSelect = async (templateId: PageTemplateId) => {
    if (!idPagina || templateId === current || savingId) return;
    setSavingId(templateId);
    try {
      await updatePage({ modeloPagina: templateId });
      showToast("Página atualizada com sucesso!", "success");
    } catch (error) {
      console.error("[PagesPage] Failed to update template:", error);
      showToast("Não foi possível atualizar a página. Tente novamente.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Páginas"
        description="Escolha o layout da sua página pública. Os seus links, foto, bio e definições mantêm-se — apenas o visual muda."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {PAGE_TEMPLATES.map((meta) => {
          const selected = meta.id === current;
          const saving = savingId === meta.id;
          return (
            <motion.div
              key={meta.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "group relative w-full rounded-2xl border p-4 text-left transition-all duration-300",
                selected
                  ? "border-white/[0.16] bg-white/[0.05] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_50px_-20px_rgba(0,0,0,0.8)]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] hover:-translate-y-0.5"
              )}
            >
              {/* Selo Em uso */}
              <AnimatePresence>
                {selected && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/[0.15]"
                  >
                    <Check className="h-3 w-3" /> Em uso
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Miniatura (clique em todo o cartão seleciona) */}
              <button
                type="button"
                onClick={() => handleSelect(meta.id)}
                disabled={!!savingId}
                aria-pressed={selected}
                className="block w-full cursor-pointer text-left"
              >
                <div className="relative mx-auto w-40 sm:w-44">
                  <div
                    className={cn(
                      "absolute -inset-3 rounded-3xl opacity-0 blur-2xl transition-opacity duration-500",
                      selected && "opacity-40"
                    )}
                    style={{ background: `linear-gradient(135deg, ${meta.accent}55, transparent)` }}
                    aria-hidden="true"
                  />
                  <div className="relative rounded-2xl p-1.5 transition-transform duration-300 group-hover:scale-[1.02]">
                    <TemplateThumbnail meta={meta} />
                  </div>
                </div>

                {/* Nome + descrição */}
                <div className="mt-4 text-center">
                  <h3 className="text-sm font-semibold tracking-tight text-white/90">
                    {meta.name}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/45">
                    {meta.description}
                  </p>
                </div>
              </button>

              {/* Botão de ação */}
              <div className="mt-4 flex justify-center">
                {selected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-4 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/[0.1]">
                    <Check className="h-3.5 w-3.5" /> Página ativa
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelect(meta.id)}
                    disabled={!!savingId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.09] px-4 py-1.5 text-xs font-medium text-white ring-1 ring-white/[0.14] transition-colors hover:bg-white/[0.14] disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {saving ? "A aplicar..." : "Usar página"}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pré-visualizar página */}
      <PremiumCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white/90">
              Pré-visualizar página
            </h3>
            <p className="mt-1 text-xs text-white/45">
              Abra a sua página pública para ver o layout em ação:
              <span className="ml-1 font-medium text-white/70">
                /u/{page.nomeUtilizador}
              </span>
            </p>
          </div>
          <GlassButton
            variant="outline"
            size="sm"
            onClick={() => router.push(`/u/${page.nomeUtilizador}`)}
          >
            <ExternalLink className="h-4 w-4" /> Ver página
          </GlassButton>
        </div>
      </PremiumCard>

      {/* Nota de escalabilidade */}
      <p className="text-center text-xs text-white/30">
        {PAGE_TEMPLATES.length} layouts disponíveis · {PAGE_TEMPLATE_BY_ID[current]?.name} em uso
      </p>
    </div>
  );
}
