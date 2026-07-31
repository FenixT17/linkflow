"use client";

import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  strong?: boolean;
}

export function PremiumCard({
  children,
  className,
  hover = false,
  strong = false,
  ...props
}: PremiumCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--glass-radius)] border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl transition-all duration-300",
        hover && "hover:border-white/[0.12] hover:bg-white/[0.05]",
        strong && "bg-white/[0.05]",
        className
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
