interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "elevated" | "flat";
  hover?: boolean;
}

export function Card({ className, variant = "glass", hover = false, children, ...props }: CardProps) {
  const base = [
    "relative overflow-hidden",
    variant === "glass" && "glass-card",
    variant === "elevated" && "glass-card glass-strong",
    variant === "flat" && "!bg-transparent !border-transparent !backdrop-filter-none",
    hover && "glass-card-hover",
    "transition-all duration-300",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={base} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["flex flex-col gap-1 p-5 pb-2 relative z-[1]", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={["text-base font-semibold tracking-tight text-[var(--foreground)]", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={["text-sm text-[var(--muted-foreground)]", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["p-5 pt-2 relative z-[1]", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
