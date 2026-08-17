import { LinkItem } from "@/lib/types";
import { ExternalLink } from "lucide-react";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

interface PreviewPhoneProps {
  nomeUtilizador?: string;
  nomeExibicao?: string;
  bio?: string;
  links: LinkItem[];
}

export function PreviewPhone({
  nomeUtilizador = "alex",
  nomeExibicao = "Alex Creator",
  bio = "Criador digital e designer",
  links,
}: PreviewPhoneProps) {
  return (
    <div className="relative mx-auto w-full max-w-[260px] rounded-[2.5rem] border border-white/[0.12] bg-[#0c0c0c] p-3 glass-shadow">
      <div className="absolute inset-x-0 top-5 z-10 flex justify-center">
        <div className="h-5 w-24 rounded-full bg-black/80 border border-white/[0.08]" />
      </div>
      <div className="relative overflow-hidden rounded-[2rem] bg-[var(--background)] border border-white/[0.08]">
        <div className="flex min-h-[420px] flex-col items-center px-4 py-10">
          <div className="h-20 w-20 rounded-full glass border border-white/[0.12] mb-3" />
          <h3 className="text-base font-semibold text-[var(--foreground)]">{nomeExibicao}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">@{nomeUtilizador}</p>
          <p className="mt-2 text-center text-xs text-[var(--muted-foreground)] leading-relaxed">
            {bio}
          </p>
          <div className="mt-6 w-full space-y-2.5">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card-hover flex w-full items-center justify-between rounded-[var(--glass-radius)] glass px-4 py-3 text-sm text-[var(--foreground)]"
              >
                <span className="flex items-center gap-2 truncate relative z-[1]">
                  {link.icone && (
                    <PlatformIcon
                      platformId={link.icone}
                      size={14}
                      color={getPlatform(link.icone)?.color ?? "#A1A1AA"}
                    />
                  )}
                  <span className="truncate">{link.titulo}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0 relative z-[1]" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
