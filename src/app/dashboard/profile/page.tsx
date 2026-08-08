"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { PremiumCard } from "@/components/ui/premium-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  uploadFile,
  updatePageBanner,
  removePageBanner,
} from "@/lib/services";
import {
  Camera,
  Upload,
  Trash2,
  AlertCircle,
  Globe2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

function compressImage(
  file: File,
  maxWidth = 1024,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (h * maxWidth) / w;
        w = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        file.type || "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

type Toast = { text: string; type: "success" | "error" } | null;

function useAutoSave(save: () => Promise<void>, deps: unknown[]) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const trigger = useCallback(async () => {
    setSaving(true);
    try {
      await save();
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }, [save]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void trigger();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { saving, lastSaved };
}

export default function ProfilePage() {
  const { page, pageId, updatePage, refreshPage } = useAuth();
  const [displayName, setDisplayName] = useState(page?.displayName || "");
  const [bio, setBio] = useState(page?.bio || "");
  const [username, setUsername] = useState(page?.username || "");

  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(page?.displayName || "");
    setBio(page?.bio || "");
    setUsername(page?.username || "");
  }, [page?.displayName, page?.bio, page?.username]);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!pageId) return;

      if (!VALID_TYPES.includes(file.type)) {
        showToast("Formato não suportado. Use JPG, PNG ou WEBP.", "error");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast("Ficheiro demasiado grande. Máximo 5MB.", "error");
        return;
      }

      let previewUrl: string | null = null;
      setUploading(true);
      try {
        previewUrl = URL.createObjectURL(file);
        setBannerPreview(previewUrl);

        const compressed = await compressImage(file);
        const compressedFile = new File([compressed], file.name, {
          type: file.type,
        });

        const uploaded = await uploadFile("files", compressedFile);
        await updatePageBanner(pageId, uploaded.$id);
        await refreshPage();

        showToast("Banner atualizado.", "success");
      } catch {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setBannerPreview(null);
        showToast("Erro ao fazer upload do banner.", "error");
      } finally {
        setUploading(false);
      }
    },
    [pageId, showToast, refreshPage]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) await handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleRemove = useCallback(async () => {
    if (!pageId || !page?.banner) return;
    setUploading(true);
    try {
      await removePageBanner(pageId);
      setBannerPreview(null);
      await refreshPage();
      showToast("Banner removido.", "success");
    } catch {
      showToast("Erro ao remover.", "error");
    } finally {
      setUploading(false);
    }
  }, [page, pageId, refreshPage, showToast]);

  const saveProfile = useCallback(async () => {
    if (!pageId) return;
    await updatePage({
      displayName: displayName.trim(),
      bio: bio.trim(),
    });
  }, [pageId, displayName, bio, updatePage]);

  useAutoSave(saveProfile, [displayName, bio]);

  const currentBanner = bannerPreview || page?.banner;

  const isUploading = uploading;

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

      <PremiumCard className="p-0 overflow-hidden" strong>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative h-48 sm:h-56 bg-[var(--background)] overflow-hidden group"
          >
            {currentBanner ? (
              <Image
                src={currentBanner}
                alt="Banner"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/30">
                <Camera className="h-8 w-8" />
                <span className="text-sm">
                  Arraste um banner ou clique para upload
                </span>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploading}
                className="glass-btn !h-9 !px-3 text-xs flex items-center gap-1.5"
                aria-label="Alterar banner"
              >
                <Upload className="h-4 w-4" /> Alterar
              </button>
              {currentBanner && (
                <button
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="glass-btn !h-9 !w-9 !p-0 flex items-center justify-center text-red-400"
                  aria-label="Remover banner"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
                e.target.value = "";
              }}
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="displayName"
                  className="text-sm font-medium text-white/80"
                >
                  Nome público
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="O seu nome"
                  className="glass-input w-full px-4 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="bio"
                  className="text-sm font-medium text-white/80"
                >
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Escreva algo sobre si..."
                  rows={4}
                  className="glass-input w-full px-4 py-2.5 text-sm resize-none"
                />
              </div>
            </div>
          </div>
      </PremiumCard>
    </div>
  );
}
