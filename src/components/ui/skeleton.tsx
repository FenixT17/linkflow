"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  circle?: boolean;
  pulse?: boolean;
}

export function Skeleton({
  className,
  circle,
  pulse = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.06]",
        pulse && "animate-pulse",
        circle && "rounded-full",
        !circle && "rounded-lg",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}
