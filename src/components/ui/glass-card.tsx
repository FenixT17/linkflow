"use client";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong";
  hover?: boolean;
}

export function GlassCard({
  className,
  variant = "default",
  hover = true,
  children,
  ...props
}: GlassCardProps) {
  const base = [
    "relative overflow-hidden rounded-[var(--glass-radius)]",
    variant === "default" && "glass-card",
    variant === "strong" && "glass-card glass-strong",
    hover && "glass-card-hover",
    "transition-all duration-300 ease-[var(--ease-glass)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={base} {...props}>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
