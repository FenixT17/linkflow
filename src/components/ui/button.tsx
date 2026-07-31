"use client";

import { forwardRef } from "react";
import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonBaseOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function getButtonClasses({ variant = "primary", size = "md", className }: ButtonBaseOptions & { className?: string }) {
  return [
    "inline-flex items-center justify-center gap-2 font-medium relative overflow-hidden",
    "transition-all duration-[250ms] ease-[var(--ease-glass)]",
    "active:scale-[0.97] active:transition-all active:duration-[100ms]",
    "disabled:opacity-[0.35] disabled:pointer-events-none disabled:cursor-not-allowed",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]",
    "select-none",
    variant === "primary" && [
      "glass-btn-primary",
      "h-10 px-5 text-sm rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "secondary" && [
      "glass-btn",
      "h-10 px-5 text-sm rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "outline" && [
      "glass-btn",
      "!bg-transparent !backdrop-filter-none",
      "h-10 px-5 text-sm rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "ghost" && [
      "!bg-transparent !backdrop-filter-none border-transparent",
      "hover:!bg-white/[0.04] hover:border-white/[0.06]",
      "h-10 px-4 text-sm rounded-[var(--glass-radius)]",
    ].join(" "),
    variant === "destructive" && [
      "glass-btn",
      "!bg-red-500/10 !border-red-500/20 text-red-400",
      "hover:!bg-red-500/15 hover:!border-red-500/30",
      "h-10 px-5 text-sm rounded-[var(--glass-radius)]",
    ].join(" "),
    size === "sm" && variant === "primary" && "h-8 px-3.5 text-xs rounded-[calc(var(--glass-radius)*0.75)]",
    size === "sm" && variant !== "primary" && "h-8 px-3.5 text-xs rounded-[calc(var(--glass-radius)*0.75)]",
    size === "lg" && variant === "primary" && "h-12 px-7 text-base rounded-[var(--glass-radius)]",
    size === "lg" && variant !== "primary" && "h-12 px-7 text-base rounded-[var(--glass-radius)]",
    size === "icon" && "h-9 w-9 p-0 rounded-[calc(var(--glass-radius)*0.75)]",
    className,
  ]
    .flat()
    .filter(Boolean)
    .join(" ");
}

function ButtonContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="relative z-[1]">{children}</span>
      <span className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none z-0" />
    </>
  );
}

export interface ButtonProps
  extends ButtonBaseOptions,
    React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={getButtonClasses({ variant, size, className })}
        {...props}
      >
        <ButtonContent>{children}</ButtonContent>
      </button>
    );
  }
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends ButtonBaseOptions,
    React.ComponentPropsWithoutRef<typeof Link> {}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        className={getButtonClasses({ variant, size, className })}
        {...props}
      >
        <ButtonContent>{children}</ButtonContent>
      </Link>
    );
  }
);
ButtonLink.displayName = "ButtonLink";
