"use client";

import Link from "next/link";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  href?: string;
  target?: string;
  rel?: string;
}

export function GlassButton({
  children,
  className,
  variant = "secondary",
  size = "md",
  href,
  target,
  rel,
  ...props
}: GlassButtonProps) {
  const base = [
    "group/btn relative inline-flex items-center justify-center gap-2 font-medium",
    "transition-all duration-[250ms] ease-[var(--ease-glass)]",
    "active:scale-[0.97] active:transition-all active:duration-[100ms]",
    "disabled:pointer-events-none disabled:opacity-[0.35]",
    "select-none focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]",
    variant === "primary" && [
      "glass-btn-primary",
      size === "sm" && "h-9 px-4 text-sm rounded-[calc(var(--glass-radius)*0.75)]",
      size === "md" && "h-11 px-5 text-sm rounded-[var(--glass-radius)]",
      size === "lg" && "h-12 px-7 text-base rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "secondary" && [
      "glass-btn",
      size === "sm" && "h-9 px-4 text-sm rounded-[calc(var(--glass-radius)*0.75)]",
      size === "md" && "h-11 px-5 text-sm rounded-[var(--glass-radius)]",
      size === "lg" && "h-12 px-7 text-base rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "ghost" && [
      "!bg-transparent !backdrop-filter-none border-transparent",
      "hover:!bg-white/[0.04] hover:border-white/[0.06]",
      "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      size === "sm" && "h-9 px-4 text-sm rounded-[calc(var(--glass-radius)*0.75)]",
      size === "md" && "h-11 px-5 text-sm rounded-[var(--glass-radius)]",
      size === "lg" && "h-12 px-7 text-base rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "outline" && [
      "glass-btn",
      "!bg-transparent !backdrop-filter-none",
      size === "sm" && "h-9 px-4 text-sm rounded-[calc(var(--glass-radius)*0.75)]",
      size === "md" && "h-11 px-5 text-sm rounded-[var(--glass-radius)]",
      size === "lg" && "h-12 px-7 text-base rounded-[var(--glass-radius)]",
    ].join(" "),
    className,
  ]
    .flat()
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="relative z-[1]">{children}</span>
      {variant === "primary" && (
        <span className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none z-0" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} target={target} rel={rel} className={base}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={base} {...props}>
      {inner}
    </button>
  );
}
