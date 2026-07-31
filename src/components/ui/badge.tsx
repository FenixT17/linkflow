interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const base = [
    "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium",
    "backdrop-filter backdrop-blur-[8px] saturate-[var(--glass-saturation)]",
    variant === "default" && "glass-badge",
    variant === "success" && "glass-badge-success",
    variant === "warning" && "glass-badge-warning",
    variant === "destructive" && "glass-badge-destructive",
    variant === "outline" && "glass-badge !bg-transparent",
    "transition-all duration-200",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={base} {...props}>
      {children}
    </span>
  );
}
