"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { SectionHeader } from "@/components/ui/section-header";
import { AlertCircle, Globe2, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { text: string; type: "success" | "error" } | null;

export default function ProfilePage() {
  const { page, pageId, updatePage, refreshPage } = useAuth();
  const [username, setUsername] = useState(page?.username || "");

  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    setUsername(page?.username || "");
  }, [page?.username]);

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!pageId || !page) return;
    setPublishing(true);
    try {
      const next = !page.published;
      await updatePage({ published: next });
      await refreshPage();
      showToast(
        next ? "Página publicada com sucesso." : "Página despublicada.",
        "success"
      );
    } catch {
      showToast("Erro ao alterar o estado de publicação.", "error");
    } finally {
      setPublishing(false);
    }
  }, [page, pageId, updatePage, refreshPage, showToast]);

  const handlePreview = useCallback(() => {
    const publicUsername = page?.username || username;
    if (!publicUsername) {
      showToast("Utilizador ainda não disponível.", "error");
      return;
    }
    if (!page?.published) {
      showToast("Publica a página antes de pré-visualizar.", "error");
      return;
    }
    const win = window.open(`/@${publicUsername}`, "_blank");
    if (win) win.opener = null;
  }, [page, username, showToast]);

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Perfil"
        description="Personalize a sua página pública."
      >
        <div className="flex flex-wrap items-center justify-end gap-2 mt-2 sm:mt-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              page?.published
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                page?.published ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            {page?.published ? "Publicado" : "Não publicado"}
          </span>

          <button
            type="button"
            onClick={handlePreview}
            disabled={!page?.published || !page?.username}
            title={
              page?.published
                ? "Abrir página pública"
                : "Publica a página para poder pré-visualizar"
            }
            aria-label={
              page?.published
                ? "Abrir página pública"
                : "Publica a página para poder pré-visualizar"
            }
            className="glass-btn inline-flex items-center gap-1.5 !h-9 !px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="h-4 w-4" />
            Pré-visualizar
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className={cn(
              "inline-flex items-center gap-1.5 !h-9 !px-3 text-xs rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
              page?.published
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            )}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : page?.published ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Globe2 className="h-4 w-4" />
            )}
            {page?.published ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </SectionHeader>

      {toast && (
        <div
          className={cn(
            "rounded-[var(--glass-radius)] p-4 text-sm flex items-center gap-3",
            toast.type === "error"
              ? "border border-red-500/30 bg-red-500/10 text-red-200"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {toast.text}
        </div>
      )}
    </div>
  );
}
