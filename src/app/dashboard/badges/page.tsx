"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Lock, X, Gift, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { BADGES, VERIFIED_DONATION_PRICE } from "@/lib/badges";
import { applyForStaff, getStaffApplicationStatus, grantBadge, revokeBadge } from "@/lib/services";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";

export default function BadgesPage() {
  const { page, pageId, account, refreshPage } = useAuth();
  const { showToast } = useToast();

  const [donateOpen, setDonateOpen] = useState(false);
  const [donating, setDonating] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffStatus, setStaffStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const staffApproved = staffStatus === "approved";

  // Badges ativas = badges guardadas na página + "pro" (derivada do plano)
  // e staff derivada da aprovação server-side.
  const earned = useMemo(() => {
    const set = new Set<string>((page?.badges ?? []).filter((badge) => badge !== "staff"));
    if (account?.plan && account.plan !== "free") set.add("pro");
    if (staffApproved) set.add("staff");
    return set;
  }, [page, account, staffApproved]);

  // Estado da candidatura ao staff (reavaliado quando a página muda)
  useEffect(() => {
    let cancelled = false;
    getStaffApplicationStatus()
      .then((app) => {
        if (cancelled) return;
        setStaffStatus(app ? app.status : null);
        // Candidatura aprovada → concede automaticamente a badge staff.
        // Só faz refresh quando a badge foi realmente concedida (evita loop:
        // o refresh cria uma referência nova de page, mas a dependência usa
        // pageId, que não muda, e o grantBadge idempotente devolve false).
        if (app?.status === "approved") {
          grantBadge("staff")
            .then((granted) => {
              if (granted) void refreshPage();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setStaffStatus(null);
      });
    return () => {
      cancelled = true;
    };
    // pageId é estável: o refresh da página não reexecuta este efeito (sem loop)
  }, [pageId, refreshPage]);

  // Sincroniza a badge pro com o plano da conta (concede/remove conforme o plano)
  useEffect(() => {
    if (!pageId) return;
    const paid = Boolean(account?.plan && account.plan !== "free");
    const sync = paid ? grantBadge("pro") : revokeBadge("pro");
    sync
      .then((granted) => {
        // revokeBadge devolve undefined — refresh apenas quando algo mudou
        if (granted === true || granted === undefined) void refreshPage();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.plan, pageId]);

  const has = (id: string) => earned.has(id);

  const handleDonate = async () => {
    if (!page) {
      showToast("Cria primeiro a tua página para desbloquear badges.", "error");
      return;
    }
    setDonating(true);
    try {
      // Doação simulada (Sessão 26): concede verified + supporter de imediato.
      // Quando houver chaves Stripe, este fluxo será substituído por um
      // Checkout real com webhook a conceder as badges.
      await grantBadge("verified");
      await grantBadge("supporter");
      await refreshPage();
      setDonateOpen(false);
      showToast("Doação concluída! Badges Verificado e Apoiante ativas. 🎉");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível concluir a doação.", "error");
    } finally {
      setDonating(false);
    }
  };

  const handleApplyStaff = async () => {
    if (staffMessage.trim().length < 20) {
      showToast("Explica um pouco mais porque queres fazer parte do staff (mín. 20 caracteres).", "error");
      return;
    }
    setApplying(true);
    try {
      const app = await applyForStaff(staffMessage);
      setStaffStatus(app.status);
      setApplyOpen(false);
      setStaffMessage("");
      showToast("Candidatura enviada! A equipa vai analisar. 💙");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível enviar a candidatura.", "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Badges"
        description="Mostre a sua presença no LinkFlow. Cada badge aparece na sua página pública."
      />

      {/* Resumo */}
      <PremiumCard className="p-5" strong>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.1] text-xl font-semibold text-white/80">
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
              <p className="text-xs text-white/50 truncate">
                {page ? `@${page.username}` : "Cria a tua página para começar"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {BADGES.filter((b) => has(b.id)).map((b) => {
              const Icon = b.icon;
              return (
                <span
                  key={b.id}
                  title={b.name}
                  aria-label={b.name}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${b.accent}26`, color: b.accent }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                </span>
              );
            })}
          </div>
        </div>
      </PremiumCard>

      {/* Grelha de badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BADGES.map((badge, i) => {
          const Icon = badge.icon;
          const active = has(badge.id);
          const staffPending = badge.id === "staff" && staffStatus === "pending";
          const staffBadgeApproved = badge.id === "staff" && staffStatus === "approved";
          const staffRejected = badge.id === "staff" && staffStatus === "rejected";

          let stateLabel: string | null = null;
          if (active) stateLabel = "Ativa";
          else if (staffPending) stateLabel = "Em análise";
          else if (staffBadgeApproved) stateLabel = "Aprovada";
          else if (staffRejected) stateLabel = "Não aprovada";

          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-colors duration-300",
                active
                  ? "border-white/25 bg-white/[0.04]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-b opacity-20 pointer-events-none", badge.gradient)} aria-hidden="true" />

              <div className="relative flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${badge.accent}22`, color: badge.accent }}
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                {stateLabel ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      active
                        ? "bg-emerald-500/15 text-emerald-400"
                        : staffPending
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-white/[0.06] text-white/50"
                    )}
                  >
                    {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    {stateLabel}
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
                {badge.id === "verified" && !active && (
                  <GlassButton
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => setDonateOpen(true)}
                  >
                    <Gift className="h-4 w-4" /> Doar {VERIFIED_DONATION_PRICE}€ e desbloquear
                  </GlassButton>
                )}
                {badge.id === "staff" && !active && !staffPending && !staffBadgeApproved && (
                  <GlassButton
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setApplyOpen(true)}
                  >
                    <ShieldCheck className="h-4 w-4" /> Candidatar ao staff
                  </GlassButton>
                )}
                {badge.id === "pro" && !active && (
                  <GlassButton variant="outline" size="sm" className="w-full" href="/dashboard/billing">
                    Atualizar para Pro <ArrowRight className="h-4 w-4" />
                  </GlassButton>
                )}
                {active && (
                  <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-400/80">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Concedida
                  </p>
                )}
                {staffPending && (
                  <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-400/80">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> A aguardar revisão da equipa
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal: doação simulada */}
      <AnimatePresence>
        {donateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => !donating && setDonateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0a] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
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
                  Desbloqueia a insígnia <span className="font-medium text-purple-300">Verificado</span> (roxo) junto à
                  foto de perfil e a badge <span className="font-medium text-emerald-300">Apoiante</span>. A doação apoia
                  o desenvolvimento do LinkFlow.
                </p>
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/40">
                  Nota: pagamento <span className="text-white/70">simulado</span> nesta fase — as badges são concedidas de
                  imediato. Pagamento real via Stripe chega em breve.
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

      {/* Modal: candidatura ao staff */}
      <AnimatePresence>
        {applyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => !applying && setApplyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0a] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative p-6">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-700" />
                <button
                  onClick={() => !applying && setApplyOpen(false)}
                  className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white/80"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white/90">Faça parte do staff</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  Conte-nos porque gostaria de fazer parte da equipa do LinkFlow. A candidatura será analisada pela equipa.
                </p>
                <textarea
                  value={staffMessage}
                  onChange={(e) => setStaffMessage(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="O que o motiva a querer fazer parte do staff?"
                  className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-sky-400/40"
                />
                <p className="mt-1 text-right text-[11px] text-white/30">{staffMessage.length}/4000</p>
                <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row">
                  <GlassButton
                    type="button"
                    className="w-full sm:flex-1"
                    onClick={() => setApplyOpen(false)}
                    disabled={applying}
                  >
                    Cancelar
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="primary"
                    className="w-full sm:flex-1"
                    onClick={handleApplyStaff}
                    loading={applying}
                  >
                    {applying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> A enviar...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" /> Enviar candidatura
                      </>
                    )}
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nota */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <Lock className="h-4 w-4 shrink-0 mt-0.5 text-white/40" />
        <p className="text-xs leading-relaxed text-white/40">
          As badges <span className="text-white/70">Early Adopter</span> e <span className="text-white/70">Parceiro</span>{" "}
          são concedidas diretamente pela equipa. A badge <span className="text-white/70">Staff</span> é concedida após
          aprovação da candidatura. As badges aparecem automaticamente na sua página pública{" "}
          <span className="text-white/70">/u/{page?.username ?? "username"}</span>.
        </p>
      </div>
    </div>
  );
}
