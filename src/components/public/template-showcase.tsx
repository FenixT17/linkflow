"use client";

import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const templates = [
  { name: "Glass", gradient: "from-white/[0.12] to-white/[0.04]", accent: "bg-white/20", description: "Elegante e minimalista" },
  { name: "Neon", gradient: "from-purple-500/20 to-blue-500/10", accent: "bg-purple-400/30", description: "Futurista e vibrante" },
  { name: "Luxury", gradient: "from-amber-500/20 to-orange-500/10", accent: "bg-amber-400/30", description: "Premium e sofisticado" },
  { name: "Mono", gradient: "from-white/[0.08] to-white/[0.02]", accent: "bg-white/10", description: "Clean e profissional" },
  { name: "Gradient", gradient: "from-pink-500/20 to-violet-500/10", accent: "bg-pink-400/30", description: "Colorido e dinâmico" },
  { name: "Futuristic", gradient: "from-cyan-500/20 to-emerald-500/10", accent: "bg-cyan-400/30", description: "Inovador e moderno" },
];

function MiniPreview({ template }: { template: (typeof templates)[0] }) {
  return (
    <div className="relative w-full aspect-[9/16] max-w-[120px] rounded-xl overflow-hidden glass-card border-white/[0.08]">
      <div className="h-3 flex items-center justify-center pt-1">
        <div className="h-1 w-8 rounded-full bg-white/10" />
      </div>
      <div className="flex justify-center mt-3">
        <div className={`h-5 w-5 rounded-full ${template.accent}`} />
      </div>
      <div className="flex justify-center mt-1.5">
        <div className="h-1.5 w-12 rounded bg-white/15" />
      </div>
      <div className="flex justify-center mt-0.5">
        <div className="h-1 w-8 rounded bg-white/10" />
      </div>
      <div className="px-2 mt-2.5 space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-3.5 rounded-md bg-gradient-to-r ${template.gradient} border border-white/[0.06]`} />
        ))}
      </div>
    </div>
  );
}

export function TemplateShowcase() {
  return (
    <section id="templates" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)] tracking-tight">
            Templates premium
          </h2>
          <p className="mt-4 text-base md:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Escolha entre templates profissionais. Cada um cuidadosamente desenhado para impressionar.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-5">
          {templates.map((template, i) => (
            <ScrollReveal key={template.name} delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="group cursor-pointer"
              >
                <div className="glass-card glass-card-hover p-3">
                  <div className="flex justify-center relative z-[1]">
                    <MiniPreview template={template} />
                  </div>
                  <div className="mt-3 text-center relative z-[1]">
                    <h3 className="text-sm font-medium text-[var(--foreground)]">{template.name}</h3>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{template.description}</p>
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
