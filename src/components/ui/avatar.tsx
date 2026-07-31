import Image from "next/image";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
}

export function Avatar({
  src,
  alt,
  size = "md",
  fallback,
  className,
  ...props
}: AvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-base",
    xl: "h-24 w-24 text-xl",
  };

  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 64,
    xl: 96,
  };

  return (
    <div
      aria-label={alt || fallback || "Avatar"}
      className={[
        "inline-flex items-center justify-center rounded-full overflow-hidden",
        "glass",
        sizeClasses[size],
        "ring-1 ring-white/[0.08] ring-offset-2 ring-offset-[var(--background)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt={alt || ""}
          width={sizeMap[size]}
          height={sizeMap[size]}
          className="object-cover w-full h-full"
        />
      ) : (
        <span className="font-medium text-[var(--foreground)]/70 relative z-[1]">
          {fallback?.charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}
