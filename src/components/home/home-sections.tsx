"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { GlassButton } from "@/components/ui/glass-button";
import { FaqItem } from "@/components/ui/faq-item";
import { faqs } from "@/data/faqs";
import {
  Check, Crown, ArrowRight, Zap, Shield, LineChart,
  Users, QrCode, Sparkles, Layout,
} from "lucide-react";

function PricingCard({
  name, price, period, description, features, variant, popular, href, buttonText,
}: {
  name: string; price: string; period: string; description: string;
  features: string[]; variant: "primary" | "secondary"; popular?: boolean;
  href: string; buttonText: string;
}) {
  return (
    <div
      className={[
        "relative h-full rounded-[calc(var(--glass-radius)*1.5)] p-6 md:p-8 transition-all duration-300",
        popular
          ? "glass-strong glass-card"
          : "glass-card glass-card-hover",
        "hover:-translate-y-1",
      ].join(" ")}
    >
      {popular && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-[1]" />
      )}

      {popular && (
        <div className="absolute right-4 top-4 z-[1]">
          <span className="inline-flex items-center gap-1 rounded-full glass-btn-primary !h-6 !px-3 text-xs font-semibold">
            <Crown className="h-3 w-3 relative z-[1]" />
            <span className="relative z-[1]">Mais Popular</span>
          </span>
        </div>
      )}

      <div className="relative z-[1] mb-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">{name}</h3>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl md:text-5xl font-semibold tracking-tight text-[var(--foreground)]">{price}</span>
          <span className="text-[var(--muted-foreground)] text-sm">{period}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>

      <ul className="relative z-[1] mb-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[var(--foreground)]/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="relative z-[1]">
        <GlassButton href={href} variant={variant} className="w-full">
          {buttonText}
        </GlassButton>
      </div>
    </div>
  );
}

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)] tracking-tight">
            Preços simples
          </h2>
          <p className="mt-4 text-base md:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Comece grátis e atualize quando estiver pronto. Sem complicações.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-sm ${!annual ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
              Mensal
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              type="button"
              className="glass-toggle inline-flex"
              data-state={annual ? "checked" : "unchecked"}
            />
            <span className={`text-sm ${annual ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
              Anual
            </span>
            {annual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-badge-success text-xs"
              >
                Poupa 17%
              </motion.span>
            )}
          </div>
        </ScrollReveal>

        <div className="grid gap-6 lg:gap-8 items-stretch lg:grid-cols-3">
          <ScrollReveal delay={0.1}>
            <PricingCard
              name="Gratuito"
              price="€0"
              period="/mês"
              description="Tudo para começar."
              features={["Até 3 links", "Foto de perfil e banner", "Biografia personalizada", "6 templates gratuitos", "Código QR", "Estatísticas básicas", "Página responsiva"]}
              variant="secondary"
              href="/register"
              buttonText="Começar Gratuitamente"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <PricingCard
              name="Pro"
              price={annual ? "€79" : "€7,99"}
              period={annual ? "/ano" : "/mês"}
              description="Para criadores que querem mais."
              features={["Tudo do plano Gratuito", "Remover marca LinkFlow", "Domínio personalizado", "Todos os templates Premium", "Analytics completos", "Histórico ilimitado", "Agendamento de links", "Pixels Meta, Google e TikTok", "Suporte prioritário"]}
              variant="primary"
              popular
              href="/register"
              buttonText="Subscrever Agora"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <PricingCard
              name="Business"
              price={annual ? "€199" : "€19,99"}
              period={annual ? "/ano" : "/mês"}
              description="Para equipas e marcas."
              features={["Tudo do plano Pro", "Até 5 membros da equipa", "Gestão da equipa", "Branding personalizado", "Workspace partilhado", "Limites mais elevados", "Prioridade máxima no suporte"]}
              variant="secondary"
              href="/register"
              buttonText="Contactar Vendas"
            />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)] tracking-tight">
            Perguntas? Respondidas.
          </h2>
          <p className="mt-4 text-base text-[var(--muted-foreground)]">
            Tudo o que precisa de saber sobre o LinkFlow.
          </p>
        </ScrollReveal>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={i * 0.05}>
              <FaqItem
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const trustFeatures = [
  { icon: Zap, title: "Hospedagem rápida", desc: "Carregamentos instantâneos em todo o mundo." },
  { icon: Shield, title: "SSL gratuito", desc: "Segurança automática para a sua página." },
  { icon: LineChart, title: "Analytics em tempo real", desc: "Dados atualizados a cada segundo." },
  { icon: Users, title: "Login Google e GitHub", desc: "Acesso rápido sem passwords." },
  { icon: QrCode, title: "QR Code", desc: "Partilhe a sua página em qualquer lado." },
  { icon: Crown, title: "Temas Premium", desc: "Designs profissionais exclusivos." },
  { icon: Sparkles, title: "IA integrada", desc: "Sugestões inteligentes para a sua página." },
  { icon: Layout, title: "Domínio personalizado", desc: "Use o seu próprio domínio." },
];

function TrustSection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)] tracking-tight">
            Porquê o LinkFlow?
          </h2>
          <p className="mt-4 text-base md:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Tudo o que precisa para criar a sua presença online perfeita.
          </p>
        </ScrollReveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustFeatures.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.05}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="group h-full"
              >
                <div className="glass-card glass-card-hover h-full p-6">
                  <div className="relative z-[1] mb-4 flex h-11 w-11 items-center justify-center rounded-[calc(var(--glass-radius)*0.75)] glass">
                    <f.icon className="h-5 w-5 text-[var(--foreground)]/80 relative z-[1]" />
                  </div>
                  <h3 className="relative z-[1] text-[var(--foreground)] font-medium tracking-tight mb-1.5">
                    {f.title}
                  </h3>
                  <p className="relative z-[1] text-sm text-[var(--muted-foreground)] leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <div className="relative overflow-hidden glass-card p-10 md:p-16">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none z-0" />
            <div className="relative z-[1]">
              <h2 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)] tracking-tight">
                Pronto para começar?
              </h2>
              <p className="mt-4 text-base md:text-lg text-[var(--muted-foreground)] max-w-xl mx-auto">
                Crie a sua página personalizada em minutos. É gratuito para sempre.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <GlassButton href="/register" variant="primary" size="lg" className="group">
                  Começar agora
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 relative z-[1]" />
                </GlassButton>
                <GlassButton href="/demo" variant="secondary" size="lg">
                  Ver demo
                </GlassButton>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default function HomeSections() {
  return (
    <>
      <TrustSection />
      <PricingSection />
      <FaqSection />
      <CTASection />
    </>
  );
}
