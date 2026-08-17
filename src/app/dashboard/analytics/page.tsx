"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  Eye,
  MousePointer,
  Percent,
  Users,
  TrendingUp,
  ArrowDownRight,
  Calendar,
  Download,
  Smartphone,
  Monitor,
  Tablet,
  Activity,
  UserRound,
  Clock,
} from "lucide-react";
import { countryFlag, timeAgo, formatVisitTime, escapeCsv } from "@/lib/utils";

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

function exportAnalyticsCSV(analytics: ReturnType<typeof useAuth>["analytics"]) {
  const lines: string[] = [];
  lines.push("LinkFlow Analytics Export");
  lines.push("");

  lines.push("Métricas");
  lines.push("Visualizações,Cliques,CTR,Visitantes");
  lines.push(`${analytics.visualizacoes},${analytics.cliques},${analytics.ctr},${analytics.uniqueVisitors}`);
  lines.push("");

  if (analytics.dailyStats.length > 0) {
    lines.push("Estatísticas diárias");
    lines.push("Data,Visualizações,Cliques");
    analytics.dailyStats.forEach((d) => {
      lines.push(`${d.day},${d.visualizacoes},${d.cliques}`);
    });
    lines.push("");
  }

  if (analytics.topLinks.length > 0) {
    lines.push("Top links");
    lines.push("Título,Cliques,CTR");
    analytics.topLinks.forEach((l) => {
      lines.push(`${escapeCsv(l.titulo)},${l.cliques},${l.ctr}`);
    });
    lines.push("");
  }

  if (analytics.topCountries.length > 0) {
    lines.push("Países");
    lines.push("País,Visitas");
    analytics.topCountries.forEach((c) => {
      lines.push(`${escapeCsv(c.pais)},${c.count}`);
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

export default function AnalyticsPage() {
  const { analytics } = useAuth();
  const mounted = useMounted();
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const safe = useMemo(
    () => ({
      visualizacoes: analytics?.visualizacoes ?? 0,
      cliques: analytics?.cliques ?? 0,
      ctr: analytics?.ctr ?? 0,
      uniqueVisitors: analytics?.uniqueVisitors ?? 0,
      weeklyGrowth: analytics?.weeklyGrowth ?? 0,
      monthlyGrowth: analytics?.monthlyGrowth ?? 0,
      topDevices: analytics?.topDevices ?? [],
      dailyStats: analytics?.dailyStats ?? [],
    }),
    [analytics]
  );

  const recentVisitors = (analytics?.recentVisitors ?? []).slice(0, 6);

  const chartData = useMemo(() => {
    if (safe.dailyStats.length >= range) {
      return safe.dailyStats.slice(-range).map((d) => ({ name: d.day.slice(5), visualizacoes: d.visualizacoes, cliques: d.cliques }));
    }
    return [];
  }, [safe.dailyStats, range]);

  const deviceData = useMemo(
    () =>
      safe.topDevices.map((d) => ({
        name: d.tipo === "mobile" ? "Telemóvel" : d.tipo === "desktop" ? "Desktop" : "Tablet",
        tipo: d.tipo,
        value: d.percentage,
      })),
    [safe.topDevices]
  );

  const metrics = [
    { label: "Visualizações", value: formatNumber(safe.visualizacoes), icon: Eye, trend: safe.weeklyGrowth },
    { label: "Cliques", value: formatNumber(safe.cliques), icon: MousePointer, trend: safe.weeklyGrowth },
    { label: "CTR", value: `${safe.ctr}%`, icon: Percent },
    { label: "Visitantes", value: formatNumber(safe.uniqueVisitors), icon: Users, trend: safe.monthlyGrowth },
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
              chartData.length > 0 ? (
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
                <div className="flex h-full w-full flex-col items-center justify-center text-center">
                  <Calendar className="h-8 w-8 text-white/20 mb-3" />
                  <p className="text-sm text-white/40">Ainda não há dados suficientes</p>
                  <p className="mt-1 text-xs text-white/25">
                    O gráfico aparecerá aqui após os primeiros visitantes.
                  </p>
                </div>
              )
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
              const Icon = deviceIcons[device.tipo] || Smartphone;
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

      <PremiumCard className="p-6" strong>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white/90">
              Últimos visitantes
            </h3>
            <p className="text-sm text-white/50">Atividade recente na página</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Clock className="h-3.5 w-3.5" /> <span>Em tempo real</span>
          </div>
        </div>

        {recentVisitors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentVisitors.map((visitor) => (
              <div
                // O mesmo visitante (hashVisitante) pode voltar várias vezes — a
                // chave tem de ser única por ACESSO (id + hora), não por visitante.
                key={`${visitor.id}-${visitor.time}`}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-white/[0.06]">
                  <UserRound className="h-4 w-4 text-white/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-white/90 truncate">
                    <span className="text-base leading-none" aria-hidden="true">
                      {countryFlag(visitor.codigoPais)}
                    </span>
                    <span className="truncate">{visitor.pais || "Desconhecido"}</span>
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {visitor.navegador} • {visitor.sistemaOperativo}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-white/50"
                  title={
                    visitor.time && formatVisitTime(visitor.time)
                      ? `Visitou às ${formatVisitTime(visitor.time)}`
                      : undefined
                  }
                >
                  <Clock className="h-3 w-3" />
                  <span className="tabular-nums">
                    {visitor.time ? timeAgo(visitor.time) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title="Ainda não há visitantes registados"
            description="Quando alguém visitar a sua página, os dados aparecerão aqui."
          />
        )}
      </PremiumCard>
    </div>
  );
}
