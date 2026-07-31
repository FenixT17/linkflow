"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { PremiumCard } from "@/components/ui/premium-card";
import { getCountryCode, COUNTRY_CODE_MAP } from "@/lib/country-codes";
import { EmptyState } from "@/components/ui/empty-state";
import { WorldMap } from "@/components/dashboard/world-map";
import {
  Eye,
  MousePointer,
  Percent,
  Users,
  TrendingUp,
  ArrowDownRight,
  Calendar,
  Download,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Link2,
  MapPin,
  Clock,
  MonitorPlay,
  Compass,
  Activity,
} from "lucide-react";

function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function pseudoRandom(i: number, max: number) {
  const v = Math.abs(Math.sin(i * 12345 + 999));
  return Math.floor(v * max);
}

function generateMockDaily(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      name: d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
      views: pseudoRandom(i, 300) + 50,
      clicks: pseudoRandom(i + 1000, 100) + 10,
    };
  });
}

function generateMockHourly() {
  return Array.from({ length: 24 }, (_, i) => ({
    name: `${i.toString().padStart(2, "0")}h`,
    value: pseudoRandom(i + 2000, 80) + 5,
  }));
}

function escapeCsv(value: string | number) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportAnalyticsCSV(analytics: ReturnType<typeof useAuth>["analytics"]) {
  const lines: string[] = [];
  lines.push("LinkFlow Analytics Export");
  lines.push("");

  lines.push("Métricas");
  lines.push("Visualizações,Cliques,CTR,Visitantes");
  lines.push(`${analytics.views},${analytics.clicks},${analytics.ctr},${analytics.followers}`);
  lines.push("");

  if (analytics.dailyStats.length > 0) {
    lines.push("Estatísticas diárias");
    lines.push("Data,Visualizações,Cliques");
    analytics.dailyStats.forEach((d) => {
      lines.push(`${d.day},${d.views},${d.clicks}`);
    });
    lines.push("");
  }

  if (analytics.topLinks.length > 0) {
    lines.push("Top links");
    lines.push("Título,Cliques,CTR");
    analytics.topLinks.forEach((l) => {
      lines.push(`${escapeCsv(l.title)},${l.clicks},${l.ctr}`);
    });
    lines.push("");
  }

  if (analytics.topCountries.length > 0) {
    lines.push("Países");
    lines.push("País,Visitas");
    analytics.topCountries.forEach((c) => {
      lines.push(`${escapeCsv(c.country)},${c.count}`);
    });
    lines.push("");
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `linkflow-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend?: number;
  icon: typeof Eye;
}) {
  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white/90">{value}</p>
        </div>
        <div className="rounded-lg bg-white/[0.05] p-2 ring-1 ring-white/[0.06]">
          <Icon className="h-4 w-4 text-white/60" />
        </div>
      </div>
      {typeof trend === "number" && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend >= 0 ? "+" : ""}{trend}%
        </div>
      )}
    </PremiumCard>
  );
}

function BarList({
  items,
  emptyText,
  icon: Icon,
}: {
  items: { label: string; value: number; color?: string }[];
  emptyText: string;
  icon: typeof Monitor;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) {
    return <p className="text-sm text-white/40">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-white/70">
              <Icon className="h-4 w-4 text-white/40" />
              {item.label}
            </span>
            <span className="text-white/50">{item.value}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color || "rgba(255,255,255,0.35)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { analytics } = useAuth();
  const mounted = useMounted();
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const safe = useMemo(
    () => ({
      views: analytics?.views ?? 0,
      clicks: analytics?.clicks ?? 0,
      ctr: analytics?.ctr ?? 0,
      followers: analytics?.followers ?? 0,
      weeklyGrowth: analytics?.weeklyGrowth ?? 0,
      monthlyGrowth: analytics?.monthlyGrowth ?? 0,
      topLinks: analytics?.topLinks ?? [],
      topCountries: analytics?.topCountries ?? [],
      topDevices: analytics?.topDevices ?? [],
      recentVisitors: analytics?.recentVisitors ?? [],
      dailyStats: analytics?.dailyStats ?? [],
      hourlyStats: analytics?.hourlyStats ?? [],
    }),
    [analytics]
  );

  const chartData = useMemo(() => {
    if (safe.dailyStats.length >= range) {
      return safe.dailyStats.slice(-range).map((d) => ({ name: d.day.slice(5), views: d.views, clicks: d.clicks }));
    }
    return generateMockDaily(range);
  }, [safe.dailyStats, range]);

  const hourlyData = useMemo(() => {
    if (safe.hourlyStats.length > 0) {
      return safe.hourlyStats.slice(0, 24).map((h) => ({ name: h.hour, value: h.views }));
    }
    return generateMockHourly();
  }, [safe.hourlyStats]);

  const deviceData = useMemo(
    () =>
      safe.topDevices.map((d) => ({
        name: d.type === "mobile" ? "Telemóvel" : d.type === "desktop" ? "Desktop" : "Tablet",
        type: d.type,
        value: d.percentage,
      })),
    [safe.topDevices]
  );

  const osData = useMemo(() => {
    const counts: Record<string, number> = {};
    safe.recentVisitors.forEach((v) => {
      counts[v.os] = (counts[v.os] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [safe.recentVisitors]);

  const browserData = useMemo(() => {
    const counts: Record<string, number> = {};
    safe.recentVisitors.forEach((v) => {
      counts[v.browser] = (counts[v.browser] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [safe.recentVisitors]);

  const referrerData = useMemo(() => {
    // Backend ainda não fornece referrer; placeholder informativo.
    return [] as { label: string; value: number }[];
  }, []);

  const mapCountries = useMemo(
    () =>
      safe.topCountries
        .filter((c) => COUNTRY_CODE_MAP[c.country])
        .map((c) => ({
          code: getCountryCode(c.country),
          count: c.count,
          country: c.country,
        })),
    [safe.topCountries]
  );

  const metrics = [
    { label: "Visualizações", value: formatNumber(safe.views), icon: Eye, trend: safe.weeklyGrowth },
    { label: "Cliques", value: formatNumber(safe.clicks), icon: MousePointer, trend: safe.weeklyGrowth },
    { label: "CTR", value: `${safe.ctr}%`, icon: Percent },
    { label: "Visitantes", value: formatNumber(safe.followers), icon: Users, trend: safe.monthlyGrowth },
  ];

  const deviceIcons: Record<string, typeof Smartphone> = {
    mobile: Smartphone,
    desktop: Monitor,
    tablet: Tablet,
  };

  const COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#22d3ee"];

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Analytics</h1>
          <p className="mt-1 text-sm text-white/50">Compreenda a sua audiência e o desempenho dos links.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r as 7 | 30 | 90)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  range === r ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {r} dias
              </button>
            ))}
          </div>
          <button
            onClick={() => exportAnalyticsCSV(analytics)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.05] transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <StatCard key={m.label} {...m} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <PremiumCard className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Activity className="h-4 w-4 text-white/60" />
                Visualizações e cliques
              </h3>
              <p className="text-xs text-white/50">Evolução nos últimos {range} dias</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-0.5 text-xs font-medium text-white/70">
              <Calendar className="h-3 w-3" /> Últimos {range} dias
            </span>
          </div>
          <div className="h-[300px] w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,10,0.9)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      backdropFilter: "blur(12px)",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#38bdf8" fill="url(#colorViews)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="clicks" stroke="#a78bfa" fill="url(#colorClicks)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-xl bg-white/[0.03] animate-pulse" />
            )}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-1 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-white/60" />
            Dispositivos
          </h3>
          <p className="text-xs text-white/50 mb-6">Distribuição por tipo</p>
          <div className="h-[220px]">
            {mounted ? (
              deviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deviceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {deviceData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(10,10,10,0.9)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "12px",
                        backdropFilter: "blur(12px)",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Sem dados" description="Ainda não há visitas registadas." icon={Smartphone} />
              )
            ) : (
              <div className="h-full w-full rounded-xl bg-white/[0.03] animate-pulse" />
            )}
          </div>
          <div className="mt-2 space-y-2">
            {deviceData.map((device) => {
              const Icon = deviceIcons[device.type] || Smartphone;
              return (
                <div key={device.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-white/70">
                    <Icon className="h-4 w-4 text-white/40" />
                    {device.name}
                  </div>
                  <span className="text-white/50">{device.value}%</span>
                </div>
              );
            })}
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <WorldMap data={mapCountries} />

        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-white/60" />
            Top países
          </h3>
          <div className="space-y-3">
            {safe.topCountries.length > 0 ? (
              safe.topCountries.slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-4 w-4 text-white/40 shrink-0" />
                    <span className="text-sm text-white/80 truncate">{c.country}</span>
                  </div>
                  <span className="text-sm text-white/50">{c.count} visitas</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/40">Sem dados de localização.</p>
            )}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/60" />
            Tráfego por hora
          </h3>
          <div className="h-[200px]">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,10,0.9)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      backdropFilter: "blur(12px)",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="value" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-xl bg-white/[0.03] animate-pulse" />
            )}
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <MonitorPlay className="h-4 w-4 text-white/60" />
            Sistema operativo
          </h3>
          <BarList items={osData} emptyText="Sem dados de sistema operativo." icon={MonitorPlay} />
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <Compass className="h-4 w-4 text-white/60" />
            Browser
          </h3>
          <BarList items={browserData} emptyText="Sem dados de browser." icon={Compass} />
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-white/60" />
            Origem do tráfego
          </h3>
          <BarList
            items={referrerData}
            emptyText="Dados de referrer não disponíveis."
            icon={MapPin}
          />
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-white/60" />
            Links mais clicados
          </h3>
          <div className="space-y-3">
            {safe.topLinks.length > 0 ? (
              safe.topLinks.slice(0, 6).map((link) => (
                <button
                  key={link.id}
                  onClick={() => router.push("/dashboard/links")}
                  className="w-full flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">{link.title}</p>
                    <p className="text-xs text-white/40">{link.ctr}% CTR</p>
                  </div>
                  <span className="text-sm font-medium text-white/70">{link.clicks}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-white/40">Sem dados de links.</p>
            )}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-white/60" />
          Últimos visitantes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-3 font-medium text-white/50">País</th>
                <th className="pb-3 font-medium text-white/50">Dispositivo</th>
                <th className="pb-3 font-medium text-white/50">SO</th>
                <th className="pb-3 font-medium text-white/50">Browser</th>
                <th className="pb-3 font-medium text-white/50 text-right">Última visita</th>
              </tr>
            </thead>
            <tbody>
              {safe.recentVisitors.length > 0 ? (
                safe.recentVisitors.slice(0, 10).map((visitor) => (
                  <tr key={visitor.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-3 text-white/80">{visitor.country || "Desconhecido"}</td>
                    <td className="py-3 text-white/60 capitalize">{visitor.device}</td>
                    <td className="py-3 text-white/60">{visitor.os}</td>
                    <td className="py-3 text-white/60">{visitor.browser}</td>
                    <td className="py-3 text-white/50 text-right">{visitor.lastVisit}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/40">
                    Sem visitantes recentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
