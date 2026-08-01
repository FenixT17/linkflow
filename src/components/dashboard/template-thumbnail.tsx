import { cn } from "@/lib/utils";
import type { PageTemplateMeta } from "@/lib/page-templates";

/**
 * Miniatura (mockup de telemóvel) de um template. Cada archetype tem uma
 * estrutura de mini-layout diferente, usando o gradiente e acento do
 * template para dar identidade própria.
 */
export function TemplateThumbnail({ meta }: { meta: PageTemplateMeta }) {
  const { thumb, accent } = meta;

  const phone =
    "relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-white/12 bg-[#0a0a0a] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]";

  const dot = (size = 8, extra = "") => (
    <span
      className={cn("block rounded-full", extra)}
      style={{ width: size, height: size, backgroundColor: accent }}
    />
  );

  const bar = (w: string, h = 4, extra = "") => (
    <span
      className={cn("block rounded-full bg-white/20", extra)}
      style={{ width: w, height: h }}
    />
  );

  const phoneFrame = (children: React.ReactNode, center = true) => (
    <div className={phone}>
      <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15" />
      <div className={cn("relative flex h-full w-full flex-col px-3 pt-6 pb-2", center && "items-center")}>
        {children}
      </div>
    </div>
  );

  switch (thumb) {
    case "minimal":
      return phoneFrame(
        <>
          <div className="mt-3">{dot(14)}</div>
          <div className="mt-2">{bar("w-16", 5, "bg-white/30")}</div>
          <div className="mt-1">{bar("w-10", 3)}</div>
          <div className="mt-5 w-full space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex w-full items-center justify-between border-b border-white/10 pb-2">
                {bar("w-14", 4)}
                <span className="block h-2 w-2 rounded-full bg-white/15" />
              </div>
            ))}
          </div>
        </>,
      );

    case "creator":
      return phoneFrame(
        <>
          <div className="mt-4 rounded-lg bg-gradient-to-br from-white/25 to-white/5 p-2" style={{ width: "100%" }}>
            <div className="flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
              {bar("w-8", 2)}
            </div>
            <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-md" style={{ background: `linear-gradient(135deg, ${accent}66, ${accent}22)` }}>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="block h-0 w-0 border-y-[5px] border-l-[9px] border-y-transparent" style={{ borderLeftColor: "#fff" }} />
              </span>
            </div>
          </div>
          <div className="mt-2">{dot(16)}</div>
          <div className="mt-1">{bar("w-14", 4, "bg-white/30")}</div>
          <div className="mt-3 w-full space-y-1.5">
            <div className="w-full rounded-md py-2" style={{ backgroundColor: accent }} />
            <div className="w-full rounded-md py-2" style={{ backgroundColor: accent }} />
          </div>
        </>,
      );

    case "business":
      return phoneFrame(
        <>
          <div className="mt-3 flex w-full items-center gap-2 border-b border-white/10 pb-3">
            <span className="block h-5 w-5 rounded" style={{ backgroundColor: accent }} />
            <div className="space-y-1">
              {bar("w-12", 4, "bg-white/30")}
              {bar("w-8", 2)}
            </div>
          </div>
          <div className="mt-3 w-full space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex w-full items-center gap-2 rounded-md border border-white/10 p-1.5">
                <span className="block h-3 w-3 rounded" style={{ backgroundColor: `${accent}55` }} />
                <div className="flex-1 space-y-1">{bar("w-12", 3)}{bar("w-8", 2)}</div>
              </div>
            ))}
          </div>
        </>,
      );

    case "store":
      return phoneFrame(
        <>
          <div className="mt-3 w-full rounded-md py-1.5 text-center" style={{ backgroundColor: accent }}>
            <span className="block h-1 w-10 rounded-full bg-black/30" style={{ margin: "0 auto" }} />
          </div>
          <div className="mt-3 grid w-full grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border border-white/10 p-1">
                <div className={cn("aspect-square w-full rounded-md", i % 2 ? "opacity-70" : "")} style={{ background: `linear-gradient(135deg, ${accent}44, ${accent}11)` }} />
                <div className="mt-1">{bar("w-9", 3)}</div>
                <div className="mt-1 rounded-sm py-1" style={{ backgroundColor: accent }} />
              </div>
            ))}
          </div>
        </>,
      );

    case "portfolio":
      return phoneFrame(
        <>
          <div className="mt-3">{dot(12)}</div>
          <div className="mt-1.5">{bar("w-16", 4, "bg-white/30")}</div>
          <div className="mt-2 flex w-full gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-2.5 flex-1 rounded-full" style={{ backgroundColor: `${accent}44` }} />
            ))}
          </div>
          <div className="mt-3 grid w-full grid-cols-2 gap-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-md border border-white/10 p-1">
                <div className="aspect-[4/3] w-full rounded-sm" style={{ background: `linear-gradient(135deg, ${accent}55, ${accent}11)` }} />
                <div className="mt-1">{bar("w-10", 3)}</div>
              </div>
            ))}
          </div>
        </>,
      );

    case "photographer":
      return phoneFrame(
        <>
          <div className="relative mt-2 w-full overflow-hidden rounded-md" style={{ height: "38%", background: `linear-gradient(135deg, ${accent}66, ${accent}22)` }}>
            <div className="absolute bottom-1 left-1.5 space-y-0.5">
              {bar("w-12", 4, "bg-white/70")}
              {bar("w-8", 2, "bg-white/40")}
            </div>
          </div>
          <div className="mt-1.5 grid w-full grid-cols-3 gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square w-full rounded-sm" style={{ backgroundColor: `rgba(255,255,255,${i % 2 ? 0.08 : 0.14})` }} />
            ))}
          </div>
        </>,
      );

    case "music":
      return phoneFrame(
        <>
          <div className="mt-3">{dot(14)}</div>
          <div className="mt-1.5">{bar("w-14", 4, "bg-white/30")}</div>
          <div className="mt-3 w-full rounded-lg p-2" style={{ backgroundColor: `${accent}22` }}>
            <div className="flex items-center gap-1.5">
              <span className="block h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
              <div className="flex-1 space-y-1">{bar("w-12", 3)}{bar("w-8", 2)}</div>
            </div>
          </div>
          <div className="mt-3 w-full space-y-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="flex w-full items-center gap-1.5 rounded-md border border-white/10 p-1.5">
                <span className="block h-3 w-3 rounded" style={{ backgroundColor: `${accent}55` }} />
                {bar("w-10", 3)}
              </div>
            ))}
          </div>
        </>,
      );

    case "restaurant":
      return phoneFrame(
        <>
          <div className="mt-3">{dot(14)}</div>
          <div className="mt-1.5">{bar("w-16", 4, "bg-white/30")}</div>
          <div className="mt-3 grid w-full grid-cols-3 gap-1.5">
            {["R", "M", "D"].map((l) => (
              <span key={l} className="block rounded-md py-1.5 text-center text-[7px] font-bold" style={{ color: accent, backgroundColor: `${accent}22` }}>
                {l}
              </span>
            ))}
          </div>
          <div className="mt-3 w-full space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex w-full items-end gap-1">
                {bar("w-10", 3)}
                <span className="flex-1 border-b border-dotted border-white/20" />
                {dot(4)}
              </div>
            ))}
          </div>
        </>,
      );

    case "event":
      return phoneFrame(
        <>
          <div className="mt-3 flex w-full justify-between">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[22%] rounded-md border border-white/10 py-1.5 text-center">
                <span className="block text-[9px] font-bold" style={{ color: accent }}>{["12", "08", "45", "20"][i]}</span>
                <span className="block text-[6px] uppercase text-white/40">dias</span>
              </div>
            ))}
          </div>
          <div className="mt-3 w-full rounded-md py-2 text-center" style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)` }}>
            <span className="block h-1.5 w-12 rounded-full bg-white/70" style={{ margin: "0 auto" }} />
          </div>
          <div className="mt-3 w-full space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex w-full items-center gap-1.5 rounded-md border border-white/10 p-1.5">
                <span className="flex h-3 w-3 items-center justify-center rounded-sm text-[6px] font-bold" style={{ backgroundColor: `${accent}44`, color: accent }}>{i + 1}</span>
                {bar("w-10", 3)}
              </div>
            ))}
          </div>
        </>,
      );

    case "resume":
      return phoneFrame(
        <>
          <div className="mt-3 flex w-full items-center gap-2 border-b border-white/10 pb-2">
            <span className="block h-6 w-6 rounded-full" style={{ backgroundColor: accent }} />
            <div className="space-y-1">{bar("w-14", 4, "bg-white/30")}{bar("w-9", 2)}</div>
          </div>
          <div className="mt-3 flex w-full gap-2">
            <div className="w-2/5 space-y-1">
              {bar("w-full", 3)}
              <div className="flex flex-wrap gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="block rounded-full px-1.5 py-0.5 text-[5px]" style={{ backgroundColor: `${accent}33`, color: accent }}>skill</span>)}
              </div>
            </div>
            <div className="w-3/5 space-y-2 border-l border-white/10 pl-2">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-0.5">
                  <span className="block h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
                  {bar("w-12", 3, "bg-white/30")}
                  {bar("w-9", 2)}
                </div>
              ))}
            </div>
          </div>
        </>,
      );

    case "gamer":
      return phoneFrame(
        <>
          <div className="mt-3 rounded-md px-2 py-0.5 font-mono text-[6px] font-bold uppercase tracking-widest" style={{ backgroundColor: `${accent}22`, color: accent }}>
            pro player
          </div>
          <div className="mt-2">{dot(14)}</div>
          <div className="mt-1.5">{bar("w-14", 4, "bg-white/30")}</div>
          <div className="mt-2.5 grid w-full grid-cols-3 gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-md border border-white/10 py-1.5 text-center">
                <span className="block text-[8px] font-bold" style={{ color: accent }}>{[3, 2, 5][i]}</span>
                <span className="block text-[5px] uppercase text-white/40">stats</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 grid w-full grid-cols-2 gap-1">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-1 rounded-md border border-white/10 p-1">
                <span className="block h-2.5 w-2.5 rounded" style={{ backgroundColor: `${accent}55` }} />
                {bar("w-7", 2.5)}
              </div>
            ))}
          </div>
        </>,
      );

    case "developer":
      return phoneFrame(
        <>
          <div className="mt-2 flex w-full gap-1">
            <span className="block h-1.5 w-1.5 rounded-full bg-red-400/70" />
            <span className="block h-1.5 w-1.5 rounded-full bg-amber-400/70" />
            <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="mt-2 w-full rounded-md border border-white/10 p-2" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-1.5">
              <span className="block h-4 w-4 rounded" style={{ backgroundColor: accent }} />
              <div className="space-y-0.5">{bar("w-12", 3, "bg-white/30")}{bar("w-8", 2)}</div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span className="block h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
              {bar("w-7", 2)}
            </div>
          </div>
          <div className="mt-2 w-full space-y-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-md border border-white/10 p-1.5">
                <div className="flex items-center justify-between">{bar("w-10", 3)}{dot(3)}</div>
                <div className="mt-1">{bar("w-14", 2)}</div>
              </div>
            ))}
          </div>
        </>,
      );

    default:
      return phoneFrame(
        <>
          <div className="mt-3">{dot(14)}</div>
          <div className="mt-2">{bar("w-16", 5, "bg-white/30")}</div>
          <div className="mt-5 w-full space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-full rounded-md border border-white/10 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        </>,
      );
  }
}
