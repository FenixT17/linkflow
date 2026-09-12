"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { ScrollReveal } from "./scroll-reveal";
import { siGithub, siX } from "simple-icons";

const footerLinks = {
  produto: [
    { label: "Funcionalidades", href: "/#features" },
    { label: "Templates", href: "/#templates" },
    { label: "Preços", href: "/#pricing" },
    { label: "Demo", href: "/demo" },
  ],
  empresa: [
    { label: "Blog", href: "#" },
    { label: "Roadmap", href: "#" },
    { label: "Status", href: "#" },
    { label: "Contacto", href: "#" },
  ],
  legal: [
    { label: "Privacidade", href: "#" },
    { label: "Termos", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

const socialLinks = [
  { iconPath: siGithub.path, hex: siGithub.hex, href: "https://github.com", label: "GitHub" },
  { iconPath: siX.path, hex: siX.hex, href: "https://x.com", label: "X" },
  { iconPath: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z", hex: "6366F1", href: "#", label: "Website" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <ScrollReveal>
          <div className="grid grid-cols-2 gap-10 md:grid-cols-5 md:gap-8">
            {/* Brand */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5 group mb-4">
                <Logo
                  size={28}
                  className="h-7 w-7 brightness-150 contrast-125"
                />
                <span className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                  LinkFlow
                </span>
              </Link>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed max-w-xs mb-6">
                Um link. Possibilidades infinitas. Crie a sua página pessoal
                premium em minutos.
              </p>
              <div className="flex items-center gap-3">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="glass-btn !h-9 !w-9 !p-0 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <svg viewBox="0 0 24 24" width={16} height={16} fill={`#${s.hex}`} aria-hidden="true" className="relative z-[1]">
                      <path d={s.iconPath} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            {Object.entries(footerLinks).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]/60 mb-4">
                  {category}
                </h4>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-200"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 glass-divider flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--muted-foreground)]/60">
            © {new Date().getFullYear()} LinkFlow. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[var(--muted-foreground)]/60">Todos os sistemas operacionais</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
