"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--glass-radius)] border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.06]">
          <Icon className="h-6 w-6 text-white/40" />
        </div>
      )}
      <h3 className="text-sm font-medium text-white/90">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-white/50">{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
