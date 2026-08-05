"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Download,
  ExternalLink,
  Palette,
  RotateCcw,
  Ruler,
  ScanLine,
  Share2,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { siteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const FG_PRESETS = ["#0a0a0a", "#8b5cf6", "#0ea5e9", "#10b981", "#ec4899", "#f59e0b", "#ef4444"];
const BG_PRESETS = ["#ffffff", "#f5f5f5", "#f3f0ff", "#e0f2fe", "#0a0a0a"];
const EXPORT_SIZES = [512, 1024, 2048] as const;

const DEFAULTS = { fgColor: "#0a0a0a", bgColor: "#ffffff", showLogo: true, exportSize: 1024 };

function normalizeHex(value: string, fallback = DEFAULTS.fgColor): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const toLin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [r, g, b] = [0, 2, 4].map((i) => toLin(parseInt(c.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Preferências da página persistidas em localStorage (limpas no logout pelo clearAppStorage). */
function useQrPref<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(`linkflow_qr_${key}`);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(`linkflow_qr_${key}`, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível — mantém apenas o estado em memória */
      }
    },
    [key]
  );
  return [value, update] as const;
}

/** Converte /logo.png num data URI para o logo ficar autocontido no SVG (download fiável). */
async function fetchLogoDataUri(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onSelect: (color: string) => void;
  label: string;
}

function ColorSwatch({ color, selected, onSelect, label }: ColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(color)}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "h-8 w-8 rounded-full border border-white/20 transition-all duration-200 hover:scale-110",
        selected && "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-[#0a0a0a]"
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export default function QrCodePage() {
  const router = useRouter();
  const { page } = useAuth();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);

  const [fgColor, setFgColor] = useQrPref<string>("fgColor", DEFAULTS.fgColor);
  const [bgColor, setBgColor] = useQrPref<string>("bgColor", DEFAULTS.bgColor);
  const [showLogo, setShowLogo] = useQrPref<boolean>("logo", DEFAULTS.showLogo);
  const [exportSizePref, setExportSize] = useQrPref<number>("size", DEFAULTS.exportSize);

  // Valores normalizados (defesa contra valores corrompidos em localStorage)
  const fg = normalizeHex(fgColor);
  const bg = normalizeHex(bgColor, DEFAULTS.bgColor);
  const exportSize = (EXPORT_SIZES as readonly number[]).includes(exportSizePref)
    ? exportSizePref
    : DEFAULTS.exportSize;

  // Utilizador sem página → criar primeiro (mesmo padrão da Aparência/Páginas).
  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  // Carrega o logo uma vez em background (usado no centro do QR quando ativo).
  useEffect(() => {
    let cancelled = false;
    void fetchLogoDataUri().then((uri) => {
      if (!cancelled) setLogoDataUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!page) {
    return null;
  }

  const username = encodeURIComponent(page.username);
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${username}`
      : `${siteUrl}/u/${username}`;

  const contrast = contrastRatio(fg, bg);
  const lowContrast = contrast < 2.5;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      showToast("Link copiado!", "success", 2500, "O URL foi copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Não foi possível copiar o link.", "error");
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "LinkFlow",
          text: "Visita a minha página no LinkFlow",
          url: publicUrl,
        });
      } else {
        await handleCopy();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast("Não foi possível partilhar o link.", "error");
    }
  };

  /** Descarrega o QR como PNG em alta resolução (renderiza o SVG num canvas). */
  const handleDownload = async () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) {
      showToast("Não foi possível gerar o QR code.", "error");
      return;
    }
    setDownloading(true);
    try {
      const serializer = new XMLSerializer();
      let svgData = serializer.serializeToString(svg);
      // Sem o namespace, alguns browsers (Safari/Firefox) recusam decodificar o SVG como imagem.
      if (!svgData.includes("xmlns")) {
        svgData = svgData.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = exportSize;
          canvas.height = exportSize;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            showToast("Não foi possível gerar o QR code.", "error");
            return;
          }
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, exportSize, exportSize);
          ctx.drawImage(img, 0, 0, exportSize, exportSize);

          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = `linkflow-${page.username}-qr.png`;
          a.click();
          showToast("QR code descarregado!", "success");
        } catch {
          showToast("Não foi possível gerar o QR code.", "error");
        } finally {
          URL.revokeObjectURL(url);
          setDownloading(false);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setDownloading(false);
        showToast("Não foi possível gerar o QR code.", "error");
      };
      img.src = url;
    } catch {
      setDownloading(false);
      showToast("Não foi possível gerar o QR code.", "error");
    }
  };

  const handleReset = () => {
    setFgColor(DEFAULTS.fgColor);
    setBgColor(DEFAULTS.bgColor);
    setShowLogo(DEFAULTS.showLogo);
    setExportSize(DEFAULTS.exportSize);
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Código QR"
        description="Gere um código QR que aponta diretamente para a sua página pública. Personalize as cores, o logo e a resolução de exportação."
      />

      {!page.published && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs leading-relaxed text-white/60">
            A sua página ainda <span className="font-medium text-amber-300">não está publicada</span>.
            O QR code já funciona, mas os visitantes só verão a página depois de a publicar no{" "}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="font-medium text-amber-300 underline-offset-2 hover:underline"
            >
              Dashboard
            </button>
            .
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* Coluna esquerda: QR + personalização */}
        <div className="space-y-6">
          {/* Cartão do QR */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard className="p-6" strong>
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div
                    className="absolute -inset-6 rounded-[2rem] opacity-30 blur-3xl"
                    style={{ background: `linear-gradient(135deg, ${fg}66, transparent, ${fg}44)` }}
                    aria-hidden="true"
                  />
                  <div
                    ref={qrRef}
                    className="relative rounded-2xl p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.15] transition-colors duration-300"
                    style={{ backgroundColor: bg }}
                  >
                    <QRCodeSVG
                      value={publicUrl}
                      size={232}
                      level={showLogo ? "H" : "M"}
                      marginSize={2}
                      bgColor={bg}
                      fgColor={fg}
                      title={`LinkFlow — ${page.username}`}
                      aria-label={`Código QR da página ${page.username}`}
                      imageSettings={
                        showLogo && logoDataUri
                          ? { src: logoDataUri, width: 38, height: 38, excavate: true }
                          : undefined
                      }
                    />
                  </div>
                </div>
                <p className="mt-6 text-sm font-medium text-white/80">
                  Escaneie para visitar a sua página
                </p>
                <p className="mt-1 max-w-full truncate text-xs text-white/40">/u/{page.username}</p>
              </div>
            </PremiumCard>
          </motion.div>

          {/* Personalização */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white/90">Personalizar QR code</h3>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/75"
                >
                  <RotateCcw className="h-3 w-3" /> Repor
                </button>
              </div>

              <div className="mt-5 space-y-5">
                {/* Cor dos módulos */}
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
                    <Palette className="h-3.5 w-3.5 text-white/40" /> Cor dos módulos
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                    {FG_PRESETS.map((color) => (
                      <ColorSwatch
                        key={color}
                        color={color}
                        selected={fg === color}
                        onSelect={setFgColor}
                        label={`Usar cor ${color} nos módulos`}
                      />
                    ))}
                    <label
                      className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-white/30 transition-transform duration-200 hover:scale-110"
                      style={{ backgroundColor: fg }}
                      title="Cor personalizada"
                    >
                      <input
                        type="color"
                        value={fg}
                        onChange={(event) => setFgColor(event.target.value)}
                        aria-label="Cor personalizada dos módulos"
                        className="absolute -inset-3 h-[200%] w-[200%] cursor-pointer opacity-0"
                      />
                      <Palette className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                    </label>
                  </div>
                </div>

                {/* Cor de fundo */}
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
                    <Palette className="h-3.5 w-3.5 text-white/40" /> Cor de fundo
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                    {BG_PRESETS.map((color) => (
                      <ColorSwatch
                        key={color}
                        color={color}
                        selected={bg === color}
                        onSelect={setBgColor}
                        label={`Usar fundo ${color}`}
                      />
                    ))}
                    <label
                      className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-white/30 transition-transform duration-200 hover:scale-110"
                      style={{ backgroundColor: bg }}
                      title="Cor personalizada"
                    >
                      <input
                        type="color"
                        value={bg}
                        onChange={(event) => setBgColor(event.target.value)}
                        aria-label="Cor personalizada de fundo"
                        className="absolute -inset-3 h-[200%] w-[200%] cursor-pointer opacity-0"
                      />
                      <Palette className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                    </label>
                  </div>
                  {lowContrast && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      Contraste baixo — alguns scanners podem não conseguir ler o QR code.
                    </p>
                  )}
                </div>

                {/* Logo no centro */}
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
                    <ScanLine className="h-3.5 w-3.5 text-white/40" /> Logo no centro
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <p className="text-xs leading-relaxed text-white/40">
                      Mostrar o logo do LinkFlow no meio do código.
                    </p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showLogo}
                      aria-label="Mostrar logo no centro do QR code"
                      onClick={() => setShowLogo(!showLogo)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                        showLogo ? "bg-purple-500/80" : "bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200",
                          showLogo ? "left-[1.375rem]" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                  {showLogo && !logoDataUri && (
                    <p className="mt-2 text-[11px] text-white/35">
                      A carregar o logo… (ou o ficheiro /logo.png não está disponível)
                    </p>
                  )}
                </div>

                {/* Tamanho do download */}
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
                    <Ruler className="h-3.5 w-3.5 text-white/40" /> Tamanho do download
                  </p>
                  <div className="mt-2.5 flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                    {EXPORT_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setExportSize(size)}
                        aria-pressed={exportSize === size}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                          exportSize === size
                            ? "bg-white/[0.12] text-white shadow-sm"
                            : "text-white/45 hover:text-white/75"
                        )}
                      >
                        {size >= 1024 ? `${Math.round(size / 1024)}K` : size} px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        </div>

        {/* Coluna direita: URL + ações */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          <PremiumCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white/90">O seu link público</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {page.published ? "Público" : "Privado"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              title="Copiar link"
              aria-label="Copiar link"
              className="mt-4 block w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.05]"
            >
              <span className="block truncate text-sm text-white/70">{publicUrl}</span>
            </button>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassButton variant="primary" onClick={handleCopy}>
                {copied ? <Copy className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado!" : "Copiar link"}
              </GlassButton>
              <GlassButton variant="secondary" onClick={handleDownload} loading={downloading}>
                <Download className="h-4 w-4" />
                {downloading ? "A gerar..." : `PNG ${exportSize}px`}
              </GlassButton>
              <GlassButton variant="secondary" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Partilhar
              </GlassButton>
              <GlassButton variant="outline" onClick={() => router.push(`/u/${username}`)}>
                <ExternalLink className="h-4 w-4" />
                Ver página
              </GlassButton>
            </div>
          </PremiumCard>

          {/* Sugestões de uso */}
          <PremiumCard className="p-5">
            <h3 className="text-sm font-semibold text-white/90">Onde usar o QR code</h3>
            <ul className="mt-4 space-y-3">
              {[
                "Cartões de visita e currículos",
                "Menus digitais de restaurantes e cafés",
                "Perfis de redes sociais e portefólios",
                "Material de eventos, flyers e embalagens",
              ].map((tip, index) => (
                <li key={tip} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: index % 2 === 0 ? "#8b5cf622" : "#22d3ee22",
                      color: index % 2 === 0 ? "#a78bfa" : "#22d3ee",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-white/55">{tip}</span>
                </li>
              ))}
            </ul>
          </PremiumCard>

          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
            <p className="text-xs leading-relaxed text-white/40">
              O QR code aponta para <span className="text-white/70">{publicUrl}</span>. Apontará
              sempre para o endereço atual da sua página — se mudar de domínio, gere um novo código
              aqui. As suas preferências ficam guardadas neste browser.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
