"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Eye,
  MousePointer,
  Percent,
  Users,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Link2,
  Globe,
  Clock,
  Calendar,
  Activity,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { PremiumCard } from "@/components/ui/premium-card";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassButton } from "@/components/ui/glass-button";
import { ResumoCard } from "@/components/dashboard/resumo-card";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

interface ChartPoint {
  label: string;
  views: number;
  clicks: number;
}

function useChartData(): ChartPoint[] {
  const { analytics } = useAuth();

  return useMemo<ChartPoint[]>(() => {
    if (analytics?.dailyStats && analytics.dailyStats.length > 0) {
      return analytics.dailyStats.map((d) => ({
        label: formatDate(d.day),
        views: d.views,
        clicks: d.clicks,
      }));
    }
    return [];
  }, [analytics]);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { color: string; value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a]/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-white/70">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: p.color }}>
          <span>{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { page, analytics, links, account, refreshAnalytics } = useAuth();

  useEffect(() => {
    if (!page) {
      router.replace("/dashboard/create");
    }
  }, [page, router]);

  // Atualização automática das estatísticas (sem recarregar a página)
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshAnalytics();
    }, 30_000);
    const onFocus = () => void refreshAnalytics();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshAnalytics]);

  const chartData = useChartData();

  const hasWeeklyGrowth = (analytics?.weeklyGrowth ?? 0) > 0;
  const hasMonthlyGrowth = (analytics?.monthlyGrowth ?? 0) > 0;

  const stats = useMemo(
    () => [
      {
        label: "Visualizações hoje",
        value: formatNumber(analytics?.views ?? 0),
        icon: Eye,
        trend: hasWeeklyGrowth
          ? { value: `+${analytics!.weeklyGrowth}% esta semana`, positive: true }
          : undefined,
      },
      {
        label: "Cliques hoje",
        value: formatNumber(analytics?.clicks ?? 0),
        icon: MousePointer,
        trend: hasMonthlyGrowth
          ? { value: `+${analytics!.monthlyGrowth}% este mês`, positive: true }
          : undefined,
      },
      {
        label: "CTR",
        value: `${analytics?.ctr ?? 0}%`,
        icon: Percent,
      },
      {
        label: "Visitantes",
        value: formatNumber(analytics?.uniqueVisitors ?? 0),
        icon: Users,
        trend:
          (analytics?.uniqueVisitors ?? 0) > 0
            ? {
                value: `${(analytics?.visitorGrowth ?? 0) > 0 ? "+" : ""}${analytics?.visitorGrowth ?? 0}% · 7 dias`,
                positive: (analytics?.visitorGrowth ?? 0) >= 0,
              }
            : undefined,
      },
    ],
    [analytics, hasWeeklyGrowth, hasMonthlyGrowth]
  );

  const recentVisitors = (analytics?.recentVisitors ?? []).slice(0, 6);

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Visão geral"
        description={`Bem-vindo de volta, ${account?.displayName || "Utilizador"}.`}
      >
        <GlassButton
          variant="primary"
          size="sm"
          onClick={() => router.push("/dashboard/links")}
        >
          <Plus className="h-4 w-4" /> Criar Link
        </GlassButton>
      </SectionHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            trend={s.trend}
          />
        ))}
      </div>

      <PremiumCard className="p-6" strong>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-white/90">
                Performance semanal
              </h3>
              <p className="text-sm text-white/50">
                Visualizações e cliques nos últimos 7 dias
              </p>
            </div>
            {(analytics?.weeklyGrowth ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <TrendingUp className="h-3.5 w-3.5" />+
                {analytics?.weeklyGrowth ?? 0}%
              </div>
            )}
          </div>
          {chartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Visualizações"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    name="Cliques"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClicks)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Calendar className="h-8 w-8 text-white/20 mb-3" />
              <p className="text-sm text-white/40">Ainda não há dados suficientes</p>
              <p className="text-xs text-white/25 mt-1">
                O gráfico aparecerá aqui após os primeiros visitantes.
              </p>
            </div>
          )}
      </PremiumCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ResumoCard links={links} analytics={analytics} />

        <PremiumCard className="lg:col-span-2 p-6" strong>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white/90">Top links</h3>
              <p className="text-sm text-white/50">Links com melhor desempenho</p>
            </div>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/analytics")}
            >
              Ver analytics <ArrowUpRight className="h-4 w-4" />
            </GlassButton>
          </div>

          {analytics?.topLinks && analytics.topLinks.length > 0 ? (
            <div className="space-y-3">
              {analytics.topLinks.slice(0, 5).map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">
                      {link.title}
                    </p>
                    <p className="text-xs text-white/40">{link.ctr}% CTR</p>
                  </div>
                  <span className="text-sm font-medium text-white/70">
                    {link.clicks} cliques
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Link2}
              title="Ainda não há dados de cliques"
              description="Os seus links começarão a aparecer aqui assim que receberem tráfego."
            />
          )}
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
                key={visitor.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
                  <Globe className="h-4 w-4 text-white/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/90 truncate">
                    {visitor.country || "Desconhecido"}
                  </p>
                  <p className="text-xs text-white/40">
                    {visitor.browser} • {visitor.os}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title="Ainda não há visitantes registados"
            description="Quando alguém visitar a sua página, os dados aparecerão aqui."
          />
        )}
      </PremiumCard>

      <PremiumCard className="p-6" strong>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/[0.06]">
              <Activity className="h-5 w-5 text-white/60" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white/90">
                Atividades recentes
              </h3>
              <p className="text-sm text-white/50">
                Resumo das ações mais recentes na sua conta.
              </p>
            </div>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={() => router.push("/dashboard/analytics")}>
            Ver tudo <ArrowRight className="h-4 w-4" />
          </GlassButton>
        </div>
        <div className="mt-6 text-center py-8 text-white/40 text-sm">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma atividade recente.</p>
        </div>
      </PremiumCard>
    </div>
  );
}
