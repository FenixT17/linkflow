"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { GlassButton } from "@/components/ui/glass-button";
import { Check, Crown, Receipt, MapPin, Loader2 } from "lucide-react";
import {
  PLAN_PRICES_EUR,
  annualPriceEur,
  convertAndFormat,
  currencySymbol,
  DEFAULT_CURRENCY,
} from "@/lib/currencies";
import { countryFlag } from "@/lib/utils";
import { syncUserGeo } from "@/lib/services";

interface PlanDef {
  id: "free" | "pro" | "business";
  name: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const plans: PlanDef[] = [
  {
    id: "free",
    name: "Gratuito",
    description: "Tudo para começar.",
    features: ["Até 3 links", "Foto de perfil e banner", "Código QR", "Estatísticas básicas"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Para criadores que querem mais.",
    features: ["Links ilimitados", "Remover marca", "Domínio personalizado", "Analytics completos", "Suporte prioritário"],
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    description: "Para equipas e marcas.",
    features: ["Tudo do Pro", "Até 5 membros", "Gestão da equipa", "Branding personalizado"],
  },
];

export default function BillingPage() {
  const { account, refreshAccount } = useAuth();
  const { showToast } = useToast();
  const [annual, setAnnual] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const currentPlan = account?.plan || "free";
  const currency = account?.currency || DEFAULT_CURRENCY;
  const countryCode = account?.countryCode || "";
  const country = account?.country || "";

  const formatPrice = (eur: number) => convertAndFormat(eur, currency);

  const handleUpgrade = (plan: PlanDef) => {
    if (plan.id === "free") return;
    showToast(`O upgrade para ${plan.name} estará disponível em breve.`, "info");
  };

  const handleDetectCountry = async () => {
    setDetecting(true);
    try {
      // force=true: o botão manual deve re-detetar por IP mesmo que a
      // conta já tenha um país guardado (o backfill automático usa o modo
      // sem force, que devolve cedo para poupar quota).
      const geo = await syncUserGeo(true);
      if (!geo || !geo.countryCode) {
        showToast("Não foi possível detetar o seu país. Tente novamente.", "error");
      } else {
        await refreshAccount();
        showToast(`País detetado: ${geo.country || geo.countryCode} · moeda ${geo.currency || "EUR"}.`);
      }
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Faturação</h1>
          <p className="mt-1 text-sm text-white/50">
            Escolha o plano ideal para si. Os preços são mostrados na moeda do seu país.
          </p>
        </div>
        {currentPlan !== "free" && (
          <span className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <Crown className="h-3 w-3" /> Plano {currentPlan === "pro" ? "Pro" : "Business"}
          </span>
        )}
      </div>

      {/* País / moeda */}
      <div className="glass-card p-4">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08]">
              <MapPin className="h-5 w-5 text-white/60" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90">
                {countryCode ? (
                  <>
                    <span className="mr-1.5">{countryFlag(countryCode)}</span>
                    {country || countryCode}
                  </>
                ) : (
                  "País não detetado"
                )}
              </p>
              <p className="text-xs text-white/50">
                Moeda dos planos: {currencySymbol(currency)} {currency}
                {currency !== "EUR" && " (convertido de EUR)"}
              </p>
            </div>
          </div>
          <GlassButton
            variant="outline"
            size="sm"
            onClick={handleDetectCountry}
            loading={detecting}
          >
            {detecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> A detetar...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" /> Detetar país
              </>
            )}
          </GlassButton>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className={`text-sm ${!annual ? "text-white/90" : "text-white/50"}`}>Mensal</span>
            <button onClick={() => setAnnual(!annual)} type="button" className="glass-toggle" data-state={annual ? "checked" : "unchecked"} />
            <span className={`text-sm ${annual ? "text-white/90" : "text-white/50"}`}>Anual</span>
            {annual && <span className="text-emerald-400 text-xs">Poupa ~17%</span>}
          </div>

          <div className="grid gap-6 lg:grid-cols-3 items-stretch">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const monthlyEur = PLAN_PRICES_EUR[plan.id];
              const priceLabel = plan.id === "free"
                ? "0"
                : formatPrice(annual ? annualPriceEur(monthlyEur) : monthlyEur);
              const period = plan.id === "free" ? "" : annual ? "/ano" : "/mês";

              return (
                <div key={plan.id} className={`glass-card p-6 flex flex-col transition-all ${plan.popular ? "ring-1 ring-white/20" : ""}`}>
                  {plan.popular && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />}
                  {plan.popular && (
                    <div className="absolute right-4 top-4 z-10">
                      <span className="inline-flex items-center gap-1 rounded-full glass-btn-primary !h-6 !px-3 text-xs font-semibold">
                        <Crown className="h-3 w-3" /> Popular
                      </span>
                    </div>
                  )}
                  <div className="relative z-10 mb-6">
                    <h3 className="text-lg font-semibold text-white/90">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl md:text-5xl font-semibold tracking-tight text-white/90">{priceLabel}</span>
                      <span className="text-white/50 text-sm">{period}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/50">{plan.description}</p>
                  </div>
                  <ul className="relative z-10 mb-8 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="relative z-10">
                    {isCurrent ? (
                      <button disabled className="glass-btn w-full justify-center opacity-50 cursor-not-allowed text-sm font-medium h-11 px-5">Plano atual</button>
                    ) : (
                      <GlassButton className="w-full" variant={plan.popular ? "primary" : "secondary"} onClick={() => handleUpgrade(plan)}>
                        {plan.id === "free" ? "Plano atual" : "Atualizar"}
                      </GlassButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="relative z-10">
          <h2 className="text-base font-semibold text-white/90 mb-1">Histórico de pagamentos</h2>
          <p className="text-sm text-white/50 mb-6">As suas transações recentes.</p>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Receipt className="h-10 w-10 text-white/30 mb-3" />
            <p className="text-sm text-white/50">Nenhum pagamento encontrado.</p>
            <p className="text-xs text-white/40 mt-1">As faturas aparecerão aqui após a primeira compra.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
