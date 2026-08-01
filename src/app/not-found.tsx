"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlassButton } from "@/components/ui/glass-button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-4">
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative"
        >
          <motion.h1
            className="text-[10rem] sm:text-[14rem] font-bold leading-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundSize: "200% 200%",
            }}
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            404
          </motion.h1>

          <div className="absolute inset-0 -z-10 blur-[60px] opacity-20">
            <div className="h-full w-full rounded-full bg-gradient-to-br from-white/30 via-transparent to-white/5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-[-1rem] sm:mt-[-2rem]"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--foreground)]/90 tracking-tight">
            Página não encontrada
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[var(--muted-foreground)] max-w-md leading-relaxed">
            O link que procuras não existe, foi movido ou está desativado.
            Verifica o endereço ou volta para o início.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <Link href="/">
            <GlassButton variant="secondary" size="lg" className="group">
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 relative z-[1]"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao início
            </GlassButton>
          </Link>

          <Link href="/dashboard">
            <GlassButton variant="primary" size="lg" className="group">
              Ir para o dashboard
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5 relative z-[1]"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </GlassButton>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-16 text-xs text-[var(--muted-foreground)]/30"
        >
          LinkFlow — {new Date().getFullYear()}
        </motion.p>
      </div>
    </main>
  );
}
