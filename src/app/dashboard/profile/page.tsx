"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  AlertCircle,
  Globe2,
  Eye,
  EyeOff,
  Loader2,
  User,
  Upload,
  Trash2,
} from "lucide-react";
import NextImage from "next/image";
import {
  uploadFile,
  updatePageAvatar,
  updatePageBanner,
  removePageAvatar,
  removePageBanner,
} from "@/lib/services";
import { Buckets } from "@/lib/appwrite";
import { cn } from "@/lib/utils";

// Validação de upload: apenas imagens raster (JPG/PNG/WEBP) até 5MB.
// O bucket `files` tem LEITURA PÚBLICA (avatares/banners são servidos a
// visitantes anónimos), por isso nunca aceitamos HTML/SVG/ficheiros
// arbitrários — um ficheiro malicioso servido do domínio Appwrite executaria
// em qualquer browser que o abrisse (stored XSS).
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Toast = { text: string; type: "success" | "error" } | null;

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.05] transition-colors"
      aria-pressed={checked}
    >
      <span className="text-sm text-white/80">{label}</span>
      <div
        className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
          checked ? "bg-white/30" : "bg-white/10"
        }`}
      >
        <div
          className={`h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}

export default function ProfilePage() {
  const { page, pageId, updatePage, refreshPage, appearance, updateAppearance } =
    useAuth();
  const [username, setUsername] = useState(page?.username || "");

  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [uploadTarget, setUploadTarget] = useState<"avatar" | "banner" | null>(
    null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "avatar" | "banner"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !pageId) return;
    setUploadError(null);
    // Validação de segurança: tipo e tamanho antes de tocar no storage.
    if (!VALID_TYPES.includes(file.type)) {
      setUploadError("Formato não suportado. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Ficheiro demasiado grande. Máximo 5MB.");
      return;
    }
    setUploadTarget(target);
    try {
      const uploaded = await uploadFile(Buckets.files, file);
      if (target === "avatar") {
        await updatePageAvatar(pageId, uploaded.$id);
      } else {
        await updatePageBanner(pageId, uploaded.$id);
      }
      await refreshPage();
    } catch (error) {
      console.error(`[ProfilePage] Failed to upload ${target}:`, error);
    } finally {
      setUploadTarget(null);
      if (target === "avatar" && avatarInputRef.current) avatarInputRef.current.value = "";
      if (target === "banner" && bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async (target: "avatar" | "banner") => {
    if (!pageId) return;
    try {
      if (target === "avatar") {
        await removePageAvatar(pageId);
      } else {
        await removePageBanner(pageId);
      }
      await refreshPage();
    } catch (error) {
      console.error(`[ProfilePage] Failed to remove ${target}:`, error);
    }
  };

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

      {uploadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {uploadError}
        </div>
      )}

      <PremiumCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
            <User className="h-4 w-4 text-white/70" />
          </div>
          <h3 className="text-sm font-semibold text-white/90 tracking-wide">
            Foto e banner
          </h3>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/80">Foto de perfil</span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={avatarInputRef}
                  onChange={(e) => handleFileChange(e, "avatar")}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadTarget === "avatar"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadTarget === "avatar" ? "A carregar..." : "Alterar"}
                </button>
                {page?.avatar && (
                  <button
                    onClick={() => handleRemoveImage("avatar")}
                    disabled={uploadTarget === "avatar"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {page?.avatar ? (
                <div className="relative h-14 w-14 rounded-full overflow-hidden ring-1 ring-white/[0.08]">
                  <NextImage
                    src={page.avatar}
                    alt="Avatar"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : (
                <div className="h-14 w-14 rounded-full bg-white/[0.05] ring-1 ring-white/[0.08]" />
              )}
              <p className="text-xs text-white/50">JPG ou PNG, até 5MB.</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/80">Banner</span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={bannerInputRef}
                  onChange={(e) => handleFileChange(e, "banner")}
                  className="hidden"
                />
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadTarget === "banner"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadTarget === "banner" ? "A carregar..." : "Alterar"}
                </button>
                {page?.banner && (
                  <button
                    onClick={() => handleRemoveImage("banner")}
                    disabled={uploadTarget === "banner"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                )}
              </div>
            </div>
            {page?.banner ? (
              <div className="relative h-24 w-full rounded-lg overflow-hidden ring-1 ring-white/[0.08]">
                <NextImage
                  src={page.banner}
                  alt="Banner"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ) : (
              <div className="h-24 w-full rounded-lg bg-white/[0.05] ring-1 ring-white/[0.08]" />
            )}
          </div>

          <div className="space-y-2 pt-2">
            <Toggle
              label="Mostrar avatar"
              checked={appearance.showAvatar}
              onChange={(checked) => updateAppearance({ showAvatar: checked })}
            />
            <Toggle
              label="Mostrar bio"
              checked={appearance.showBio}
              onChange={(checked) => updateAppearance({ showBio: checked })}
            />
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}
