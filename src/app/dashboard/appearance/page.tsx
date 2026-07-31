"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { Slider } from "@/components/ui/slider";
import { PremiumCard } from "@/components/ui/premium-card";
import { LivePreview } from "@/components/dashboard/live-preview";
import { toHexColor } from "@/lib/utils";
import { PREMIUM_TEMPLATES } from "@/lib/templates";
import NextImage from "next/image";
import {
  uploadFile,
  updatePageAvatar,
  updatePageBanner,
  removePageAvatar,
  removePageBanner,
} from "@/lib/services";
import { Buckets } from "@/lib/appwrite";
import {
  Palette,
  Type,
  Square,
  Image,
  User,
  Upload,
  Trash2,
  Check,
  Moon,
  Sun,
  Monitor,
  LayoutTemplate,
} from "lucide-react";
import type { Appearance } from "@/lib/types";

const FONTS = [
  { id: "Inter", label: "Inter" },
  { id: "Geist", label: "Geist" },
  { id: "System", label: "System" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
];

const BUTTON_STYLES: { id: Appearance["buttonStyle"]; label: string }[] = [
  { id: "glass", label: "Vidro" },
  { id: "solid", label: "Sólido" },
  { id: "outline", label: "Contorno" },
  { id: "soft", label: "Suave" },
];

const BUTTON_WIDTHS: { id: Appearance["buttonWidth"]; label: string }[] = [
  { id: "full", label: "Completo" },
  { id: "wide", label: "Largo" },
  { id: "normal", label: "Normal" },
  { id: "narrow", label: "Estreito" },
];

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
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

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <label className="relative h-8 w-8 rounded-lg overflow-hidden ring-1 ring-white/[0.08] cursor-pointer hover:ring-white/20 transition-colors">
        <input
          type="color"
          value={toHexColor(value, "#ffffff")}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={label}
        />
        <span
          className="absolute inset-0 block"
          style={{ backgroundColor: toHexColor(value, "#ffffff") }}
        />
      </label>
    </div>
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
  const { theme, setTheme } = useTheme();
  const { page, pageId, appearance, updateAppearance, refreshPage } = useAuth();

  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<"avatar" | "banner" | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  if (!page) return null;

  const handleApplyTemplate = (templateId: string) => {
    const template = PREMIUM_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setActiveTemplate(templateId);
    setTheme(template.theme);
    updateAppearance({ ...template.appearance });
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-5">
          <Section icon={LayoutTemplate} title="Templates premium">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PREMIUM_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template.id)}
                  className={`group relative rounded-xl border p-3 text-left transition-all ${
                    activeTemplate === template.id
                      ? "border-white/30 bg-white/[0.08]"
                      : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                  title={template.name}
                >
                  <div
                    className="h-10 w-full rounded-lg mb-2 ring-1 ring-white/[0.06]"
                    style={{ background: template.appearance.backgroundColor }}
                  />
                  <p className="text-xs font-medium text-white/80 truncate">{template.name}</p>
                  {activeTemplate === template.id && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
              )}
                </button>
              ))}
            </div>
          </Section>

          <Section icon={Palette} title="Tema e cores">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "dark", label: "Escuro", Icon: Moon },
                  { id: "light", label: "Claro", Icon: Sun },
                  { id: "system", label: "Sistema", Icon: Monitor },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-all ${
                      theme === t.id
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <t.Icon className="h-4 w-4 text-white/70" />
                    <span className="text-xs text-white/80">{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <ColorRow
                  label="Cor de fundo"
                  value={appearance.backgroundColor}
                  onChange={(hex) => updateAppearance({ backgroundColor: hex })}
                />
                <ColorRow
                  label="Cor do texto"
                  value={appearance.textColor}
                  onChange={(hex) => updateAppearance({ textColor: hex })}
                />
                <ColorRow
                  label="Cor de destaque"
                  value={appearance.accentColor}
                  onChange={(hex) => updateAppearance({ accentColor: hex })}
                />
                <ColorRow
                  label="Cor dos cartões"
                  value={appearance.cardColor}
                  onChange={(hex) => updateAppearance({ cardColor: hex })}
                />
              </div>
            </div>
          </Section>

          <Section icon={Type} title="Fonte e tipografia">
            <div className="space-y-4">
              <select
                value={appearance.fontFamily || "Inter"}
                onChange={(e) => updateAppearance({ fontFamily: e.target.value })}
                className="glass-input w-full px-3 py-2 text-sm rounded-xl"
              >
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <Slider
                label="Tamanho da fonte"
                value={appearance.fontSize ?? 16}
                min={12}
                max={24}
                suffix="px"
                onChange={(v) => updateAppearance({ fontSize: v })}
              />
            </div>
          </Section>

          <Section icon={Square} title="Botões">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {BUTTON_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updateAppearance({ buttonStyle: s.id })}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                      appearance.buttonStyle === s.id
                        ? "bg-white/[0.08] text-white border-white/20"
                        : "text-white/50 border-white/[0.06] hover:text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {BUTTON_WIDTHS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => updateAppearance({ buttonWidth: w.id })}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                      appearance.buttonWidth === w.id
                        ? "bg-white/[0.08] text-white border-white/20"
                        : "text-white/50 border-white/[0.06] hover:text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <Slider
                label="Raio dos botões"
                value={appearance.buttonRadius ?? 12}
                min={0}
                max={32}
                suffix="px"
                onChange={(v) => updateAppearance({ buttonRadius: v })}
              />
            </div>
          </Section>

          <Section icon={Image} title="Background">
            <div className="space-y-3">
              <p className="text-xs text-white/50">Escolha uma cor de fundo sólida. Os templates premium ajustam automaticamente o estilo do vidro.</p>
              <div className="grid grid-cols-6 gap-2">
                {[
                  "#0a0a0a",
                  "#ffffff",
                  "#0f172a",
                  "#1e1b4b",
                  "#052e16",
                  "#2a0a0a",
                  "#082f49",
                  "#1c1917",
                  "#fff7ed",
                  "#f5f3ff",
                  "#f0fdf4",
                  "#ecfeff",
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => updateAppearance({ backgroundColor: color })}
                    className={`h-8 w-full rounded-lg ring-1 ring-white/[0.08] transition-transform hover:scale-105 ${
                      appearance.backgroundColor === color ? "ring-white/40 ring-2" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Fundo ${color}`}
                  />
                ))}
              </div>
            </div>
          </Section>

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

        <div className="xl:sticky xl:top-6">
          <PremiumCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/90">Preview em tempo real</h3>
              <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex justify-center">
              <LivePreview />
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
