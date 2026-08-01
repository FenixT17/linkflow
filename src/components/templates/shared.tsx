import Image from "next/image";
import Link from "next/link";
import { sanitizeUrl } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

/** Avatar com imagem saneada ou inicial como fallback */
export function TemplateAvatar({
  src,
  name,
  size = 96,
  className,
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-full shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={sanitizeUrl(src)}
          alt={`Foto de perfil de ${name}`}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          priority
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.06] text-white/70">
          <span className="font-semibold" style={{ fontSize: size * 0.4 }}>
            {name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Rótulo de secção com barra de destaque */
export function SectionLabel({
  children,
  accent,
  className,
}: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="h-4 w-1 rounded-full"
        style={{ backgroundColor: accent || "currentColor" }}
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
        {children}
      </span>
    </div>
  );
}

/** Rodapé LinkFlow consistente em todos os templates */
export function TemplateFooter({ textColor }: { textColor?: string }) {
  return (
    <footer className="pt-14 pb-10 text-center">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium opacity-60 transition-opacity hover:opacity-100"
        style={{ color: textColor }}
      >
        <Logo size={14} className="brightness-150 contrast-125" />
        LinkFlow
      </Link>
    </footer>
  );
}
