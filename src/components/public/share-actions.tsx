"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";

interface ShareActionsProps {
  publicUrl: string;
}

export function ShareActions({ publicUrl }: ShareActionsProps) {
  const { showToast } = useToast();

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "LinkFlow",
          text: "Visita a minha página no LinkFlow",
          url: publicUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(publicUrl);
        showToast("Link copiado!", "success", 2500, "O URL foi copiado para a área de transferência.");
      } else {
        showToast("Não foi possível copiar o link.", "error");
      }
    } catch (error) {
      // Cancelar o diálogo nativo de partilha não é um erro visível para o utilizador.
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast("Não foi possível partilhar o link.", "error");
    }
  };

  return (
    <button
      onClick={handleShare}
      className="glass-btn !h-9 !w-9 !rounded-full !p-0 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      aria-label="Partilhar"
    >
      <Share2 className="relative z-[1] h-4 w-4" />
    </button>
  );
}
