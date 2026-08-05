"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink, Share2, Smartphone, TriangleAlert } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { siteUrl } from "@/lib/seo";

export default function QrCodePage() {
  const router = useRouter();
  const { page } = useAuth();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Utilizador sem página → criar primeiro (mesmo padrão da Aparência/Páginas).
  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  if (!page) {
    return null;
  }

  const username = encodeURIComponent(page.username);
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${username}`
      : `${siteUrl}/u/${username}`;

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
          const exportSize = 600;
          const canvas = document.createElement("canvas");
          canvas.width = exportSize;
          canvas.height = exportSize;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            showToast("Não foi possível gerar o QR code.", "error");
            return;
          }
          ctx.fillStyle = "#ffffff";
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

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Código QR"
        description="Gere um código QR que aponta diretamente para a sua página pública. Ideal para cartões de visita, menus, redes sociais e muito mais."
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
                  style={{ background: "linear-gradient(135deg, #8b5cf6, transparent, #22d3ee)" }}
                  aria-hidden="true"
                />
                <div
                  ref={qrRef}
                  className="relative rounded-2xl bg-white p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.15]"
                >
                  <QRCodeSVG
                    value={publicUrl}
                    size={232}
                    level="M"
                    marginSize={2}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    title={`LinkFlow — ${page.username}`}
                    aria-label={`Código QR da página ${page.username}`}
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

        {/* URL + ações */}
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
                Descarregar PNG
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
              O QR code aponta para{" "}
              <span className="text-white/70">{publicUrl}</span>. Apontará sempre para o endereço
              atual da sua página — se mudar de domínio, gere um novo código aqui.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
