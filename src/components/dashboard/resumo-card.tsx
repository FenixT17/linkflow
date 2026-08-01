"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Globe, MonitorSmartphone, X, ChevronRight, Smartphone, Monitor, Tablet } from "lucide-react";
import type { AnalyticsData, LinkItem } from "@/lib/types";
import { PremiumCard } from "@/components/ui/premium-card";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}

function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0))
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="relative w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white/90">{title}</h3>
            <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/** Cartão de resumo clicável */
function ResumoRow({
  icon: Icon,
  iconColor,
  label,
  value,
  hint,
  onClick,
}: {
  icon: typeof Link2;
  iconColor: string;
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.06]"
        style={{ backgroundColor: `${iconColor}1a`, color: iconColor }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/50">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-white/90">{value}</p>
        <p className="mt-0.5 truncate text-xs text-white/40">{hint}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />
    </button>
  );
}

interface ResumoCardProps {
  links: LinkItem[];
  analytics: AnalyticsData;
}

export function ResumoCard({ links, analytics }: ResumoCardProps) {
  const [modal, setModal] = useState<"links" | "countries" | "devices" | null>(null);

  const activeLinks = links.filter((l) => l.active && l.visible);

  // Lista completa de links ordenada por cliques (decrescente) — nunca alfabética
  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => b.clicks - a.clicks),
    [links]
  );
  const totalClicks = useMemo(
    () => links.reduce((sum, l) => sum + (l.clicks || 0), 0),
    [links]
  );
  const mostClicked = sortedLinks[0];

  // Países: apenas os que tiveram visitas, ordenados por visitantes (decrescente)
  const countries = useMemo(
    () => [...analytics.topCountries].sort((a, b) => b.count - a.count),
    [analytics.topCountries]
  );

  // Dispositivos: contagens reais com percentagem calculada
  const devices = useMemo(() => {
    const total = analytics.topDevices.reduce((s, d) => s + (d.count || 0), 0);
    return analytics.topDevices.map((d) => ({
      ...d,
      percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
    }));
  }, [analytics.topDevices]);

  const deviceMeta = {
    mobile: { label: "Telemóveis", icon: Smartphone },
    desktop: { label: "Computadores", icon: Monitor },
    tablet: { label: "Tablets", icon: Tablet },
  } as const;

  return (
    <PremiumCard className="p-0 overflow-hidden" strong>
      <div className="p-6 pb-4">
        <h3 className="text-base font-semibold text-white/90">Resumo</h3>
        <p className="text-sm text-white/50">Estado atual da página — dados reais</p>
      </div>
      <div className="divide-y divide-white/[0.06]">
        <ResumoRow
          icon={Link2}
          iconColor="#a78bfa"
          label="Links ativos"
          value={String(activeLinks.length)}
          hint={
            mostClicked
              ? `Mais clicado: ${mostClicked.title || "Link"} (${mostClicked.clicks || 0} cliques)`
              : "Sem cliques ainda"
          }
          onClick={() => setModal("links")}
        />
        <ResumoRow
          icon={Globe}
          iconColor="#38bdf8"
          label="Países"
          value={String(countries.length)}
          hint={
            countries.length > 0
              ? `${countries.length} ${countries.length === 1 ? "país com visitas" : "países com visitas"}`
              : "Sem visitas ainda"
          }
          onClick={() => setModal("countries")}
        />
        <ResumoRow
          icon={MonitorSmartphone}
          iconColor="#34d399"
          label="Dispositivos"
          value={String(devices.filter((d) => d.count > 0).length)}
          hint={
            devices.some((d) => d.count > 0)
              ? `${formatNumber(analytics.uniqueVisitors)} visitantes únicos`
              : "Sem visitas ainda"
          }
          onClick={() => setModal("devices")}
        />
      </div>

      <AnimatePresence>
        {modal === "links" && (
          <Modal
            title="Todos os links"
            subtitle={`Ordenado por cliques (${formatNumber(totalClicks)} total)`}
            onClose={() => setModal(null)}
          >
            {sortedLinks.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">Ainda não há links.</p>
            ) : (
              <ul className="space-y-2.5">
                {sortedLinks.map((link) => {
                  const clicks = link.clicks || 0;
                  const ctr = totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0;
                  return (
                    <li
                      key={link.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
                        {link.icon ? (
                          <PlatformIcon
                            platformId={link.icon}
                            size={16}
                            color={getPlatform(link.icon)?.color ?? "#fff"}
                          />
                        ) : (
                          <Link2 className="h-4 w-4 text-white/50" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">
                          {link.title || "Link"}
                        </p>
                        <p className="truncate text-xs text-white/40">{link.url}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-white/90">
                          {formatNumber(clicks)}
                        </p>
                        <p className="text-[11px] text-white/40">cliques</p>
                      </div>
                      <div className="shrink-0 w-12 text-right">
                        <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                          {ctr}%
                        </p>
                        <p className="text-[11px] text-white/40">CTR</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Modal>
        )}

        {modal === "countries" && (
          <Modal
            title="Países com visitas"
            subtitle="Apenas países onde houve visitantes"
            onClose={() => setModal(null)}
          >
            {countries.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">
                Nenhum país registado — ainda sem visitas.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {countries.map((c) => (
                  <li
                    key={c.countryCode || c.country}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                  >
                    <span className="text-xl" aria-hidden="true">
                      {countryFlag(c.countryCode)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/90">{c.country}</p>
                      {c.city && <p className="truncate text-xs text-white/40">{c.city}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-white/90">
                        {formatNumber(c.count)}
                      </p>
                      <p className="text-[11px] text-white/40">
                        {c.count === 1 ? "visitante" : "visitantes"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Modal>
        )}

        {modal === "devices" && (
          <Modal
            title="Dispositivos"
            subtitle="Distribuição por tipo — percentagens reais"
            onClose={() => setModal(null)}
          >
            {devices.every((d) => d.count === 0) ? (
              <p className="py-8 text-center text-sm text-white/40">
                Ainda sem dados de dispositivos.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {devices.map((d) => {
                  const meta = deviceMeta[d.type] ?? { label: d.type, icon: MonitorSmartphone };
                  const Icon = meta.icon;
                  return (
                    <li
                      key={d.type}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
                        <Icon className="h-4 w-4 text-white/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/90">{meta.label}</p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${d.percentage}%`, backgroundColor: "#34d399" }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-white/90">
                          {formatNumber(d.count)}
                        </p>
                        <p className="text-[11px] text-white/40">{d.percentage}%</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </PremiumCard>
  );
}
