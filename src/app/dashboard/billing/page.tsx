"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { GlassButton } from "@/components/ui/glass-button";
import { Check, Crown, Receipt } from "lucide-react";

const plans = [
  {
    name: "Gratuito",
    price: "€0",
    period: "/mês",
    description: "Tudo para começar.",
    features: ["Até 3 links", "Foto de perfil e banner", "Código QR", "Estatísticas básicas"],
  },
  {
    name: "Pro",
    price: "€7,99",
    period: "/mês",
    description: "Para criadores que querem mais.",
    features: ["Links ilimitados", "Remover marca", "Domínio personalizado", "Analytics completos", "Suporte prioritário"],
    popular: true,
  },
  {
    name: "Business",
    price: "€19,99",
    period: "/mês",
    description: "Para equipas e marcas.",
    features: ["Tudo do Pro", "Até 5 membros", "Gestão da equipa", "Branding personalizado"],
  },
];

export default function BillingPage() {
  const { account } = useAuth();
  const [annual, setAnnual] = useState(false);
  const currentPlan = account?.plan || "free";

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Faturação</h1>
          <p className="mt-1 text-sm text-white/50">Escolha o plano ideal para si.</p>
        </div>
        {currentPlan !== "free" && (
          <span className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <Crown className="h-3 w-3" /> Plano {currentPlan === "pro" ? "Pro" : "Business"}
          </span>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className={`text-sm ${!annual ? "text-white/90" : "text-white/50"}`}>Mensal</span>
            <button onClick={() => setAnnual(!annual)} type="button" className="glass-toggle" data-state={annual ? "checked" : "unchecked"} />
            <span className={`text-sm ${annual ? "text-white/90" : "text-white/50"}`}>Anual</span>
            {annual && <span className="text-emerald-400 text-xs">Poupa 17%</span>}
          </div>

          <div className="grid gap-6 lg:grid-cols-3 items-stretch">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.name.toLowerCase();
              return (
                <div key={plan.name} className={`glass-card p-6 flex flex-col transition-all ${plan.popular ? "ring-1 ring-white/20" : ""}`}>
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
                      <span className="text-4xl md:text-5xl font-semibold tracking-tight text-white/90">{annual && plan.name === "Pro" ? "€79" : annual && plan.name === "Business" ? "€199" : plan.price}</span>
                      <span className="text-white/50 text-sm">{annual ? "/ano" : plan.period}</span>
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
                      <GlassButton className="w-full" variant={plan.popular ? "primary" : "secondary"}>{plan.name === "Gratuito" ? "Plano atual" : "Atualizar"}</GlassButton>
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
