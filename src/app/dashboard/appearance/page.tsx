"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PremiumCard } from "@/components/ui/premium-card";
import { User, Upload, Trash2 } from "lucide-react";
import NextImage from "next/image";
import {
  uploadFile,
  updatePageAvatar,
  updatePageBanner,
  removePageAvatar,
  removePageBanner,
} from "@/lib/services";
import { Buckets } from "@/lib/appwrite";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PremiumCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
          <Icon className="h-4 w-4 text-white/70" />
        </div>
        <h3 className="text-sm font-semibold text-white/90 tracking-wide">{title}</h3>
      </div>
      {children}
    </PremiumCard>
  );
}

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

export default function AppearancePage() {
  const router = useRouter();
  const { page, pageId, appearance, updateAppearance, refreshPage } = useAuth();

  const [uploadTarget, setUploadTarget] = useState<"avatar" | "banner" | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  if (!page) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    if (!file || !pageId) return;
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
      console.error(`[AppearancePage] Failed to upload ${target}:`, error);
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
      console.error(`[AppearancePage] Failed to remove ${target}:`, error);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Aparência</h1>
          <p className="mt-1 text-sm text-white/50">Personalize o visual da sua página.</p>
        </div>
      </div>

      <div className="space-y-5">
          <Section icon={User} title="Foto e banner">
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
                    {page.avatar && (
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
                  {page.avatar ? (
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
                    {page.banner && (
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
                {page.banner ? (
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
                <Toggle
                  label="Mostrar redes sociais"
                  checked={appearance.showSocial}
                  onChange={(checked) => updateAppearance({ showSocial: checked })}
                />
              </div>
            </div>
          </Section>
      </div>
    </div>
  );
}
