"use client";

import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive?: boolean };
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.1] ${className || ""}`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-white/50">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-white/90">{value}</p>
          {trend && (
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                trend.positive !== false
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {trend.value}
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/[0.06] group-hover:bg-white/[0.08] transition-colors">
          <Icon className="h-5 w-5 text-white/60" />
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-white/[0.02] blur-2xl" />
    </div>
  );
}
