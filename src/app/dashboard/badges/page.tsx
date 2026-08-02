"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Lock, X, Gift } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { BADGES, VERIFIED_DONATION_PRICE } from "@/lib/badges";
import { grantBadge } from "@/lib/services";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";

export default function BadgesPage() {
  const { page, refreshPage } = useAuth();
  const { showToast } = useToast();
  const [donateOpen, setDonateOpen] = useState(false);
  const [donating, setDonating] = useState(false);

  // Nesta fase, apenas Verificado está implementado.
  const earned = useMemo(
    () => new Set<string>((page?.badges ?? []).filter((badge) => badge === "verified")),
    [page]
  );

  const has = (id: string) => earned.has(id);

  const handleUnavailableBadge = (name: string) => {
    showToast(`A funcionalidade "${name}" ainda não foi implementada.`, "info");
  };

  const handleDonate = async () => {
    if (!page) {
      showToast("Cria primeiro a tua página para desbloquear badges.", "error");
      return;
    }

    setDonating(true);
    try {
      await grantBadge("verified");
      await refreshPage();
      setDonateOpen(false);
      showToast("Doação concluída! Badge Verificado ativa. 🎉");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível concluir a doação.", "error");
    } finally {
      setDonating(false);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Badges"
        description="Mostre a sua presença no LinkFlow. Cada badge aparece na sua página pública."
      />

      <PremiumCard className="p-5" strong>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-xl font-semibold text-white/80 ring-1 ring-white/[0.1]">
                {page?.displayName?.charAt(0)?.toUpperCase() || "U"}
              </div>
              {has("verified") && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 ring-2 ring-[#0a0a0a]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90">
                {earned.size} de {BADGES.length} badges ativas
              </p>
              <p className="truncate text-xs text-white/50">
                {page ? `@${page.username}` : "Cria a tua página para começar"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {BADGES.filter((badge) => has(badge.id)).map((badge) => {
              const Icon = badge.icon;
              return (
                <span
                  key={badge.id}
                  title={badge.name}
                  aria-label={badge.name}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${badge.accent}26`, color: badge.accent }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                </span>
              );
            })}
          </div>
        </div>
      </PremiumCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BADGES.map((badge, index) => {
          const Icon = badge.icon;
          const active = has(badge.id);
          const implemented = badge.id === "verified";

          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => !implemented && handleUnavailableBadge(badge.name)}
              onKeyDown={(event) => {
                if (!implemented && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  handleUnavailableBadge(badge.name);
                }
              }}
              role={!implemented ? "button" : undefined}
              tabIndex={!implemented ? 0 : undefined}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-colors duration-300",
                active
                  ? "border-white/25 bg-white/[0.04]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                !implemented && "cursor-pointer"
              )}
            >
              <div
                className={cn("pointer-events-none absolute inset-0 bg-gradient-to-b opacity-20", badge.gradient)}
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${badge.accent}22`, color: badge.accent }}
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                {active ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                    <Check className="h-3 w-3" strokeWidth={3} /> Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/40">
                    <Lock className="h-3 w-3" /> Bloqueada
                  </span>
                )}
              </div>

              <h3 className="relative mt-4 text-base font-semibold text-white/90">{badge.name}</h3>
              <p className="relative mt-1 flex-1 text-xs leading-relaxed text-white/50">{badge.description}</p>

              <div className="relative mt-4">
                {implemented && !active && (
                  <GlassButton
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDonateOpen(true);
                    }}
                  >
                    <Gift className="h-4 w-4" /> Doar {VERIFIED_DONATION_PRICE}€ e desbloquear
                  </GlassButton>
                )}
                {!implemented && !active && (
                  <p className="text-center text-xs font-medium text-white/40">Clique para saber mais</p>
                )}
                {active && (
                  <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-400/80">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Concedida
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {donateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => !donating && setDonateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0a] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative p-6">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-700" />
                <button
                  onClick={() => !donating && setDonateOpen(false)}
                  className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white/80"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400">
                  <Gift className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white/90">Doar {VERIFIED_DONATION_PRICE}€</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  Desbloqueia a insígnia <span className="font-medium text-purple-300">Verificado</span> junto à foto de perfil.
                  A doação apoia o desenvolvimento do LinkFlow.
                </p>
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/40">
                  Nota: pagamento <span className="text-white/70">simulado</span> nesta fase. Pagamento real via Stripe chega em breve.
                </div>
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                  <GlassButton
                    type="button"
                    className="w-full sm:flex-1"
                    onClick={() => setDonateOpen(false)}
                    disabled={donating}
                  >
                    Cancelar
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="primary"
                    className="w-full sm:flex-1"
                    onClick={handleDonate}
                    loading={donating}
                  >
                    {donating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> A processar...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Doar {VERIFIED_DONATION_PRICE}€
                      </>
                    )}
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
        <p className="text-xs leading-relaxed text-white/40">
          Atualmente, apenas a badge <span className="text-white/70">Verificado</span> está implementada. As restantes
          funcionalidades serão disponibilizadas em breve.
        </p>
      </div>
    </div>
  );
}
