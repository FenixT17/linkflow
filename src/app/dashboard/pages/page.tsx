"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, LayoutGrid, ArrowUpRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PAGE_TEMPLATES, PAGE_TEMPLATE_BY_ID } from "@/lib/page-templates";
import { isPageType } from "@/lib/page-templates";
import type { PageType } from "@/lib/types";
import { TemplateThumbnail } from "@/components/dashboard/template-thumbnail";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";

export default function PagesPage() {
  const router = useRouter();
  const { page, updatePage, refreshPage } = useAuth();
  const { showToast } = useToast();

  const current = page?.pageType ?? "minimal";
  const [selected, setSelected] = useState<PageType>(isPageType(current) ? current : "minimal");
  const [saving, setSaving] = useState(false);

  // Sincroniza com o valor persistido (por exemplo, após refresh)
  useEffect(() => {
    if (page && isPageType(page.pageType)) {
      setSelected(page.pageType);
    }
  }, [page]);

  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  const selectedMeta = useMemo(() => PAGE_TEMPLATE_BY_ID[selected], [selected]);

  const handleSelect = async (id: PageType) => {
    if (id === selected || saving) return;
    setSelected(id); // optimistic
    setSaving(true);
    try {
      await updatePage({ pageType: id });
      await refreshPage();
      showToast(`Página "${PAGE_TEMPLATE_BY_ID[id].name}" aplicada.`);
    } catch (error) {
      setSelected(current); // revert
      showToast("Não foi possível guardar a página. Tente novamente.", "error");
      console.error("[PagesPage] Failed to save pageType:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Páginas"
        description="Escolha o layout da sua página pública. Cada tipo tem uma estrutura completamente diferente — a alteração é aplicada de imediato em /u/username."
      />

      {/* Estado atual */}
      <PremiumCard className="p-4" strong>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${selectedMeta.accent}22`, color: selectedMeta.accent }}
            >
              <selectedMeta.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90">
                Página ativa: <span style={{ color: selectedMeta.accent }}>{selectedMeta.name}</span>
              </p>
              <p className="text-xs text-white/50 truncate">
                {selectedMeta.description}
              </p>
            </div>
          </div>
          {page && (
            <GlassButton
              variant="outline"
              size="sm"
              href={`/u/${page.username}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver página pública <ArrowUpRight className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </PremiumCard>

      {/* Grelha de templates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {PAGE_TEMPLATES.map((meta, i) => {
          const isSelected = selected === meta.id;
          const isSavingThis = saving && isSelected;
          return (
            <motion.button
              key={meta.id}
              type="button"
              onClick={() => handleSelect(meta.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSelected}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.02] text-left transition-colors duration-300",
                isSelected
                  ? "border-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_20px_60px_-20px_rgba(0,0,0,0.9)]"
                  : "border-white/[0.07] hover:border-white/20"
              )}
            >
              {/* Thumbnail */}
              <div className="relative p-4 pb-0">
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-b opacity-40",
                    meta.gradient
                  )}
                  aria-hidden="true"
                />
                <div className="relative mx-auto w-28 sm:w-32">
                  <TemplateThumbnail meta={meta} />
                </div>
              </div>

              {/* Info */}
              <div className="relative flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4 shrink-0" style={{ color: meta.accent }} />
                  <h3 className="text-sm font-semibold text-white/90 truncate">{meta.name}</h3>
                </div>
                <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-white/50">
                  {meta.description}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300",
                      isSelected
                        ? "bg-white text-black"
                        : "bg-white/[0.06] text-white/70 group-hover:bg-white/[0.12]"
                    )}
                  >
                    {isSavingThis ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> A aplicar...
                      </>
                    ) : isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Selecionada
                      </>
                    ) : (
                      "Selecionar"
                    )}
                  </span>

                  {/* Visto com animação */}
                  <AnimatePresence>
                    {isSelected && !isSavingThis && (
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: meta.accent, color: "#000" }}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Nota de arquitetura */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <LayoutGrid className="h-4 w-4 shrink-0 mt-0.5 text-white/40" />
        <p className="text-xs leading-relaxed text-white/40">
          Cada tipo de página é um template independente com estrutura visual própria (não apenas cores).
          A seleção é guardada no Appwrite e a página pública em{" "}
          <span className="text-white/70">/u/{page?.username ?? "username"}</span> muda automaticamente.{" "}
          Nesta fase os templates não utilizam banner — apenas foto de perfil, nome, bio e o conteúdo do layout.
        </p>
      </div>
    </div>
  );
}
