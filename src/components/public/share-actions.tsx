"use client";

import { Share2 } from "lucide-react";

interface ShareActionsProps {
  publicUrl: string;
}

export function ShareActions({ publicUrl }: ShareActionsProps) {
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
        alert("Link copiado para a área de transferência!");
      }
    } catch (error) {
      console.error("[ShareActions] share failed:", error);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="glass-btn !rounded-full !h-9 !w-9 !p-0 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      aria-label="Partilhar"
    >
      <Share2 className="h-4 w-4 relative z-[1]" />
    </button>
  );
}
