"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ChunkErrorBoundary } from "@/components/ui/chunk-error-boundary";

// Import homepage structured data as a server component to avoid JSON-LD serialization in client components
import { SiteJsonLd } from "@/components/public/site-jsonld";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { IPhoneMockup } from "@/components/ui/iphone-mockup";
import { NoiseOverlay } from "@/components/ui/noise-overlay";
import { GradientOrbs } from "@/components/ui/gradient-orb";
import { GlassButton } from "@/components/ui/glass-button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  Link2,
  BarChart3,
  Palette,
  Globe,
  QrCode,
  Share2,
  Sparkles,
  Search,
  ArrowRight,
} from "lucide-react";

// Import particles with ssr:false to prevent hydration mismatch (canvas + browser-only APIs)
const Particles = dynamic(() =>
  import("@/components/ui/particles").then((m) => ({ default: m.Particles })),
  { ssr: false }
);

// Dynamically import below-the-fold sections
const HomeSections = dynamic(() => import("@/components/home/home-sections"), {
  ssr: false,
  loading: () => (
    <div className="py-24 text-center">
      <div className="inline-block h-6 w-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
    </div>
  ),
});

const features = [
  { icon: Link2, title: "Links ilimitados", desc: "Adicione quantos links quiser. Organize-os com drag & drop intuitivo." },
  { icon: BarChart3, title: "Analytics completos", desc: "Visualizações, cliques, países, dispositivos — dados reais em tempo real." },
  { icon: Palette, title: "Liquid Glass", desc: "Sistema de design premium inspirado no Apple visionOS com customização total." },
  { icon: Globe, title: "Domínio próprio (Em breve)", desc: "Suporte em desenvolvimento para utilizar o seu próprio domínio." },
  { icon: QrCode, title: "Código QR", desc: "Gere códigos QR elegantes instantaneamente para partilhar." },
  { icon: Share2, title: "44+ Redes sociais", desc: "YouTube, Spotify, TikTok, Instagram, GitHub, Twitch e muito mais." },
  { icon: Search, title: "SEO otimizado", desc: "Meta tags e imagens OpenGraph prontas para partilha profissional." },
  { icon: Sparkles, title: "Páginas & Templates", desc: "12 estruturas visuais prontas para criadores, empresas e portfólios." },
];

function HeroPhoneMockup() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
        const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
        setMousePos({ x: x * 6, y: y * 6 });
      }}
      onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
      style={{ perspective: "1200px" }}
      className="relative"
    >
      <motion.div
        animate={{
          rotateY: mousePos.x,
          rotateX: -mousePos.y,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <IPhoneMockup className="scale-[0.82] sm:scale-90 md:scale-100">
          <div className="flex min-h-[520px] flex-col items-center bg-[var(--background)] p-5 pt-10">
            <div className="relative">
              <div className="h-[72px] w-[72px] rounded-full glass border border-white/[0.12]" />
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[var(--background)]" />
            </div>

            <h3 className="mt-3 text-[15px] font-semibold text-[var(--foreground)] tracking-tight">
              Maria Silva
            </h3>
            <p className="text-[11px] text-[var(--muted-foreground)]">@mariasilva</p>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)] text-center max-w-[200px] leading-relaxed">
              Criadora de conteúdo & Designer
            </p>

            <div className="flex items-center gap-2 mt-3">
              {["bg-pink-400/15", "bg-blue-400/15", "bg-violet-400/15", "bg-cyan-400/15"].map(
                (color, i) => (
                  <div
                    key={i}
                    className={`h-6 w-6 rounded-full ${color} glass border border-white/[0.06] flex items-center justify-center`}
                  >
                    <div className="h-2 w-2 rounded-full bg-white/40" />
                  </div>
                )
              )}
            </div>

            <div className="w-full space-y-2.5 mt-4">
              {[
                { label: "Portfólio", gradient: "from-white/[0.12] to-white/[0.04]" },
                { label: "YouTube", gradient: "from-red-500/15 to-red-500/5" },
                { label: "Newsletter", gradient: "from-violet-500/15 to-violet-500/5" },
                { label: "Loja Online", gradient: "from-emerald-500/15 to-emerald-500/5" },
                { label: "Contacto", gradient: "from-amber-500/15 to-amber-500/5" },
              ].map((link, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
                  className="glass h-11 w-full rounded-[var(--glass-radius)] flex items-center justify-center"
                >
                  <span className="text-[11px] font-medium text-[var(--foreground)]/80">
                    {link.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </IPhoneMockup>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main className="relative min-h-dvh bg-[var(--background)]">
      <SiteJsonLd />
      <Particles />
      <NoiseOverlay />
      <GradientOrbs />
      <Navbar />

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative overflow-hidden pt-32 pb-20 md:pt-48 md:pb-32"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:gap-16 lg:grid-cols-2">
            <motion.div
              style={{ y: heroY, opacity: heroOpacity }}
              className="max-w-2xl"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 glass-badge-success !px-4 !py-1.5 mb-6 !rounded-full"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium">Liquid Glass — Design System inspirado no visionOS</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--foreground)] leading-[1.05]"
              >
                Um Link.
                <br />
                <span className="bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
                  Possibilidades infinitas.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="mt-7 text-base md:text-lg leading-relaxed text-[var(--muted-foreground)] max-w-lg"
              >
                Crie uma página pessoal bonita para partilhar todos os seus
                links, redes sociais, vídeos, lojas e conteúdo num só lugar.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-10 flex flex-col sm:flex-row gap-4"
              >
                <GlassButton
                  href="/register"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto group"
                >
                  Começar grátis
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 relative z-[1]" />
                </GlassButton>
                <GlassButton
                  href="/demo"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Ver demo
                </GlassButton>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="mt-5 text-xs text-[var(--muted-foreground)]/60"
              >
                Sem cartão de crédito. Comece em segundos.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
              className="relative flex justify-center lg:justify-end"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <HeroPhoneMockup />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 md:py-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-16 md:mb-20">
            <h2 className="text-3xl md:text-5xl font-semibold text-[var(--foreground)] tracking-tight">
              Tudo o que precisa
            </h2>
            <p className="mt-4 text-[var(--muted-foreground)] text-base md:text-lg max-w-2xl mx-auto">
              Funcionalidades poderosas, envolvidas numa interface lindamente minimalista.
            </p>
          </ScrollReveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
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

      {/* Below-the-fold sections (Templates, Trust, Pricing, FAQ, CTA) */}
      <Suspense
        fallback={
          <div className="py-32 text-center">
            <div className="inline-block h-8 w-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        }
      >
        <ChunkErrorBoundary
          fallback={
            <div className="py-24 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Esta secção não pôde ser carregada. Atualize a página para tentar novamente.
              </p>
            </div>
          }
        >
          <HomeSections />
        </ChunkErrorBoundary>
      </Suspense>

      <Footer />
    </main>
  );
}
