import { cn } from "@/lib/utils";
import type { PageTemplateMeta } from "@/lib/page-templates";

/**
 * Miniatura (mockup de telemóvel) de um template de página.
 * template1 = neutro premium; template2 = violeta vibrante.
 */
export function TemplateThumbnail({ meta }: { meta: PageTemplateMeta }) {
  const { thumb, accent } = meta;

  const phone =
    "relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-white/12 bg-[#0a0a0a] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]";

  const bar = (w: string, h = 4, extra = "") => (
    <span
      className={cn("block rounded-full bg-white/20", extra)}
      style={{ width: w, height: h }}
    />
  );

  const pill = (i: number, violet = false) => (
    <div
      key={i}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-full px-2.5 py-2",
        violet
          ? "ring-1 ring-violet-500/30 bg-violet-500/[0.07]"
          : "bg-white/[0.06] ring-1 ring-white/[0.08]"
      )}
    >
      <span
        className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full")}
        style={{ backgroundColor: violet ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="block rounded-full"
          style={{ width: 5, height: 5, backgroundColor: accent }}
        />
      </span>
      <span className="flex-1" />
      <span
        className={cn("block rounded-full", violet ? "bg-violet-400/70" : "bg-white/30")}
        style={{ width: 4, height: 4 }}
      />
    </div>
  );

  const phoneFrame = (children: React.ReactNode) => (
    <div className={phone}>
      <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15" />
      {/* Botão de partilha */}
      <div className="absolute right-2.5 top-4 flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-white/20">
        <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="relative flex h-full w-full flex-col items-center px-4 pt-7 pb-3">
        {children}
      </div>
    </div>
  );

  const violet = thumb === "template2";

  return phoneFrame(
    <>
      {/* Avatar com brilho */}
      <div
        className={cn(
          "mt-2 flex h-9 w-9 items-center justify-center rounded-full",
          violet
            ? "ring-2 ring-violet-500/50 shadow-[0_0_16px_-2px_rgba(139,92,246,0.6)]"
            : "ring-2 ring-white/20 shadow-[0_0_16px_-2px_rgba(255,255,255,0.3)]"
        )}
      >
        <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="mt-2">{bar("w-14", 5, violet ? "bg-violet-300/80" : "bg-white/35")}</div>
      <div className="mt-1">{bar("w-9", 3, violet ? "bg-violet-400/50" : "bg-white/25")}</div>
      <div className="mt-2 w-full space-y-1.5">
        {[0, 1, 2, 3].map((i) => pill(i, violet))}
      </div>
    </>
  );
}
