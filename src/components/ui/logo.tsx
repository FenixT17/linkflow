import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({ size = 28, className, priority }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="LinkFlow"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      priority={priority}
    />
  );
}
